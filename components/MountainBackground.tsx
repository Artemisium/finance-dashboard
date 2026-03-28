export default function MountainBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      <svg
        className="absolute bottom-0 left-0 w-full"
        viewBox="0 0 1440 320"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Back range - farthest mountains, most subtle */}
        <path
          d="M0 320 L0 240 L80 200 L160 220 L240 170 L340 190 L420 140 L520 160 L600 110 L700 130 L780 90 L880 115 L960 80 L1060 100 L1140 70 L1240 95 L1320 75 L1440 100 L1440 320 Z"
          fill="none"
          stroke="#1e1e3a"
          strokeWidth="1"
          opacity="0.5"
        />
        {/* Mid range */}
        <path
          d="M0 320 L0 270 L60 250 L130 265 L200 230 L280 245 L360 200 L460 220 L540 185 L640 205 L720 160 L820 180 L900 155 L1000 175 L1080 145 L1180 165 L1260 135 L1360 150 L1440 140 L1440 320 Z"
          fill="none"
          stroke="#252545"
          strokeWidth="1"
          opacity="0.6"
        />
        {/* Front range - closest, most visible */}
        <path
          d="M0 320 L0 295 L70 280 L150 290 L230 265 L310 278 L400 250 L490 268 L580 240 L670 258 L760 225 L850 248 L940 220 L1030 242 L1120 215 L1210 238 L1300 210 L1380 228 L1440 215 L1440 320 Z"
          fill="#0d0d1e"
          stroke="#2d2d55"
          strokeWidth="1.5"
          opacity="0.8"
        />
        {/* Foreground ridge */}
        <path
          d="M0 320 L0 305 L100 295 L200 308 L320 290 L440 302 L560 285 L680 298 L800 278 L920 295 L1040 272 L1160 288 L1280 270 L1440 285 L1440 320 Z"
          fill="#0a0a14"
          stroke="#242440"
          strokeWidth="1"
          opacity="0.9"
        />
      </svg>

      {/* Subtle gradient vignette at bottom */}
      <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-bg-primary to-transparent opacity-60" />
    </div>
  );
}
