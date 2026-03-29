export default function MountainBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      <svg
        className="absolute bottom-0 left-0 w-full h-[45vh]"
        viewBox="0 0 1440 400"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Back range gradient - most distant */}
          <linearGradient id="mountain-back" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1a1a35" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#0d0d1e" stopOpacity="0.6" />
          </linearGradient>
          {/* Mid range gradient */}
          <linearGradient id="mountain-mid" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#171730" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#0c0c1a" stopOpacity="0.7" />
          </linearGradient>
          {/* Front range gradient - closest */}
          <linearGradient id="mountain-front" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#13132a" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#0a0a18" stopOpacity="0.9" />
          </linearGradient>
          {/* Foreground ridge */}
          <linearGradient id="mountain-fore" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0f0f22" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#080814" stopOpacity="0.95" />
          </linearGradient>
        </defs>

        {/* Back range - farthest mountains, tallest peaks */}
        <path
          d="M0 400 L0 180 L60 160 L120 175 L200 120 L280 145 L360 90 L440 110 L520 65 L600 85 L680 50 L760 75 L840 40 L920 60 L1000 30 L1080 55 L1160 45 L1240 70 L1320 50 L1440 80 L1440 400 Z"
          fill="url(#mountain-back)"
        />

        {/* Mid range - medium peaks */}
        <path
          d="M0 400 L0 230 L80 210 L160 225 L250 185 L340 200 L430 155 L520 175 L610 140 L700 160 L790 120 L880 145 L970 110 L1060 135 L1150 100 L1240 125 L1330 105 L1440 130 L1440 400 Z"
          fill="url(#mountain-mid)"
        />

        {/* Front range - closer, lower peaks */}
        <path
          d="M0 400 L0 285 L90 265 L180 280 L270 245 L370 260 L460 225 L550 245 L640 210 L730 235 L820 200 L910 225 L1000 195 L1090 218 L1180 188 L1270 210 L1360 190 L1440 205 L1440 400 Z"
          fill="url(#mountain-front)"
        />

        {/* Foreground ridge - nearest, lowest */}
        <path
          d="M0 400 L0 330 L100 315 L200 328 L320 305 L440 318 L560 295 L680 310 L800 288 L920 305 L1040 282 L1160 298 L1280 278 L1440 295 L1440 400 Z"
          fill="url(#mountain-fore)"
        />
      </svg>

      {/* Gradient blend into page background */}
      <div className="absolute bottom-0 left-0 w-full h-24 bg-gradient-to-t from-bg-primary to-transparent" />

      {/* Subtle stars / ambient dots */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: 'radial-gradient(1px 1px at 20px 30px, #ffffff, transparent), radial-gradient(1px 1px at 40px 70px, #ffffff, transparent), radial-gradient(1px 1px at 80px 40px, #ffffff, transparent), radial-gradient(1px 1px at 130px 80px, #ffffff, transparent), radial-gradient(1px 1px at 200px 50px, #ffffff, transparent)',
        backgroundSize: '250px 120px',
      }} />
    </div>
  );
}
