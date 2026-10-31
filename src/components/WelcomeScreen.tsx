import moon from '../assets/selene-moon.svg?no-inline';

export default function WelcomeScreen({ready,enter}:{ready:boolean;enter:()=>void}){
  return <main className="welcome-screen" aria-label="Boas-vindas ao Selene">
    <div className="welcome-content">
      <div className="welcome-moon"><span aria-hidden="true"/><img src={moon} alt="Lua carmesim do Selene"/></div>
      <p className="welcome-eyebrow">SUAS HISTÓRIAS SOB UMA NOVA LUA</p>
      <h1>Selene<span>.</span></h1>
      <h2>Boas-vindas ao seu universo de histórias.</h2>
      <p className="welcome-message">A próxima aventura começa com uma página.</p>
      <div className="welcome-status" role="status">{ready?'Tudo pronto para sua próxima leitura.':'Preparando seu espaço de leitura…'}</div>
      <button className="welcome-enter" disabled={!ready} onClick={enter}>Entrar no catálogo <span aria-hidden="true">→</span></button>
    </div>
  </main>;
}
