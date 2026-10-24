/** Maskot Komodo berekor api. Sumber gambar: output/logo (dibuat tim). */
export default function Logo({ size = 44 }: { size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="logo" src="/agmon-mark.png" width={size} height={size} alt="" aria-hidden />;
}
