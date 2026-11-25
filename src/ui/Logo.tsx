import logo from '../assets/logo-np.png';

/** Logo original da agência (branco, fundo transparente) + identificação tipográfica. */
export function Logo({ subtitle = 'Hall da Fama' }: { subtitle?: string }) {
  return (
    <>
      <img src={logo} alt="" width={44} height={26} />
      <span className="brand-text"><b>Agência NP</b><span>{subtitle}</span></span>
    </>
  );
}
