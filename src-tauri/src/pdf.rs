use crate::storage::Result;
use std::path::{Path, PathBuf};

pub fn import(source: &Path, target: &Path) -> Result<Vec<PathBuf>> {
    use std::io::Read;
    let mut file = std::fs::File::open(source).map_err(|e| e.to_string())?;
    if file.metadata().map_err(|e| e.to_string())?.len() > 512 * 1024 * 1024 {
        return Err("O PDF excede o limite de 512 MiB".into());
    }
    let mut header = [0; 5];
    if file.read_exact(&mut header).is_err() || &header != b"%PDF-" {
        return Err("O arquivo não possui um cabeçalho PDF válido".into());
    }
    render(source, target)
}

#[cfg(not(windows))]
fn render(_: &Path, _: &Path) -> Result<Vec<PathBuf>> {
    Err("A importação de PDF está disponível somente no Windows".into())
}

#[cfg(windows)]
fn render(source: &Path, target: &Path) -> Result<Vec<PathBuf>> {
    use std::{os::windows::process::CommandExt, process::{Command, Stdio}, time::{Duration, Instant}};
    // The embedded script is fixed; user paths are environment values, never shell code.
    let system = std::env::var_os("SystemRoot").ok_or("Pasta do Windows indisponível")?;
    let powershell = PathBuf::from(system).join("System32/WindowsPowerShell/v1.0/powershell.exe");
    let mut child = Command::new(powershell)
        .args(["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", include_str!("pdf-render.ps1")])
        .env("YOMI_PDF_SOURCE", source).env("YOMI_PDF_TARGET", target)
        .stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::null())
        .creation_flags(0x08000000).spawn().map_err(|_| "Não foi possível iniciar o conversor PDF do Windows")?;
    let start = Instant::now();
    loop {
        match child.try_wait() {
            Ok(Some(_)) => break,
            Ok(None) if start.elapsed() < Duration::from_secs(300) => std::thread::sleep(Duration::from_millis(100)),
            other => {
                let _ = child.kill(); let _ = child.wait();
                return Err(if other.is_err() { "Falha ao acompanhar a conversão do PDF" } else { "A conversão do PDF excedeu cinco minutos; divida o arquivo" }.into());
            }
        }
    }
    let output = child.wait_with_output().map_err(|e| e.to_string())?;
    let result = String::from_utf8_lossy(&output.stdout);
    if !output.status.success() {
        return Err(match result.trim() {
            "PDF_PAGE_LIMIT" => "O PDF precisa ter entre 1 e 1.000 páginas",
            "PDF_BYTE_LIMIT" => "O PDF convertido excedeu 64 MiB por página ou 1 GiB por volume",
            _ => "Não foi possível converter o PDF. Verifique se está íntegro e sem senha. O conversor requer o Windows PowerShell e o recurso PDF do Windows disponíveis.",
        }.into());
    }
    let count: usize = result.trim().parse().map_err(|_| "Resposta inválida do conversor PDF")?;
    if !(1..=1000).contains(&count) { return Err("Quantidade inválida de páginas PDF".into()); }
    let mut total = 0;
    let mut pages = Vec::with_capacity(count);
    for index in 0..count {
        let path = target.join(format!("{index:06}.png"));
        let size = std::fs::metadata(&path).map_err(|_| "Página PDF não foi convertida")?.len();
        total += size;
        if size == 0 || size > 64 * 1024 * 1024 || total > 1024 * 1024 * 1024 {
            return Err("Tamanho das páginas PDF excede o limite".into());
        }
        pages.push(path);
    }
    Ok(pages)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::Library;
    use std::fs;

    #[cfg(windows)]
    fn document(path: &Path) {
        let objects = [
            "<< /Type /Catalog /Pages 2 0 R >>",
            "<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>",
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] /Resources << >> >>",
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 300] /Resources << >> >>",
        ];
        let mut pdf = String::from("%PDF-1.4\n");
        let mut offsets = vec![0];
        for (index, object) in objects.iter().enumerate() {
            offsets.push(pdf.len()); pdf.push_str(&format!("{} 0 obj\n{object}\nendobj\n", index + 1));
        }
        let xref = pdf.len();
        pdf.push_str("xref\n0 5\n0000000000 65535 f \n");
        for offset in &offsets[1..] { pdf.push_str(&format!("{offset:010} 00000 n \n")); }
        pdf.push_str(&format!("trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n"));
        fs::write(path, pdf).unwrap();
    }

    #[test]
    fn invalid_pdf_leaves_no_book_or_partial_files() {
        let temp = tempfile::tempdir().unwrap();
        let library = Library::new(temp.path().join("data")).unwrap();
        let path = temp.path().join("invalid.pdf");
        fs::write(&path, b"not a PDF").unwrap();
        assert!(library.import(&path, "pdf").unwrap_err().contains("cabeçalho"));
        assert!(library.list().unwrap().is_empty());
        assert_eq!(fs::read_dir(library.root.join("library")).unwrap().count(), 0);
    }

    #[cfg(windows)]
    #[test]
    fn windows_pdf_renders_pages_and_preserves_reading_data() {
        let temp = tempfile::tempdir().unwrap();
        let library = Library::new(temp.path().join("data")).unwrap();
        // Punctuation and Unicode must remain data rather than PowerShell syntax.
        let path = temp.path().join("Mangá ' & $ volume.pdf");
        document(&path);
        let book = library.import(&path, "pdf").unwrap();
        assert_eq!(book.format, "pdf"); assert_eq!(book.page_count, 2);
        let opened = library.open(&book.id).unwrap();
        for (index, page) in opened.pages.iter().enumerate() {
            let bytes = fs::read(page).unwrap();
            assert!(bytes.starts_with(b"\x89PNG\r\n\x1a\n"));
            let width = u32::from_be_bytes(bytes[16..20].try_into().unwrap());
            let height = u32::from_be_bytes(bytes[20..24].try_into().unwrap());
            assert_eq!((width, height), if index == 0 { (1500, 2000) } else { (2000, 1500) });
        }
        library.progress(&book.id, 1, true).unwrap(); library.bookmark(&book.id, 1, true).unwrap();
        assert_eq!(library.import(&path, "pdf").unwrap().id, book.id);
        let reopened = Library::new(library.root.clone()).unwrap().open(&book.id).unwrap();
        assert_eq!(reopened.book.page, 1); assert!(reopened.book.completed);
        assert_eq!(reopened.bookmarks, vec![1]);
        let broken = temp.path().join("broken.pdf"); fs::write(&broken, b"%PDF-1.4\ninvalid").unwrap();
        assert!(library.import(&broken, "pdf").is_err());
        assert_eq!(library.list().unwrap().len(), 1);
        assert_eq!(fs::read_dir(library.root.join("library")).unwrap().count(), 1);
    }
}
