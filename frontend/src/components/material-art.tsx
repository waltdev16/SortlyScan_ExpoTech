import { useId } from "react";
import type { MaterialId } from "@/data/content";

// Ilustraciones vectoriales ligeras: un ejemplo editorial, nunca una imagen capturada.
export function MaterialArt({
  material = "plastic",
}: {
  material?: MaterialId;
}) {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      viewBox="0 0 320 380"
      fill="none"
      aria-hidden="true"
      className={`material-art art-${material}`}
    >
      <defs>
        <linearGradient
          id={`${id}-glass`}
          x1="85"
          y1="160"
          x2="240"
          y2="190"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#b6c4bf" stopOpacity=".22" />
          <stop offset=".24" stopColor="#e8f4ed" stopOpacity=".85" />
          <stop offset=".38" stopColor="#809a92" stopOpacity=".4" />
          <stop offset=".68" stopColor="#b9ccc5" stopOpacity=".7" />
          <stop offset=".9" stopColor="#eaf4ef" stopOpacity=".9" />
          <stop offset="1" stopColor="#7d8c86" stopOpacity=".3" />
        </linearGradient>
        <linearGradient
          id={`${id}-cap`}
          x1="130"
          y1="0"
          x2="190"
          y2="0"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#486849" />
          <stop offset=".45" stopColor="#c5f36b" />
          <stop offset="1" stopColor="#6a8f4d" />
        </linearGradient>
        <linearGradient id={`${id}-metal`}>
          <stop stopColor="#6f8076" />
          <stop offset=".25" stopColor="#e0e8dd" />
          <stop offset=".55" stopColor="#8f9e93" />
          <stop offset=".8" stopColor="#d3ddd2" />
          <stop offset="1" stopColor="#59665e" />
        </linearGradient>
      </defs>
      <ellipse cx="161" cy="344" rx="83" ry="13" fill="#0a1a0b" opacity=".2" />
      {(material === "plastic" || material === "glass") && (
        <g transform="rotate(15 160 190)">
          <path
            d="M137 70H183V112C183 129 205 138 214 159C220 173 219 191 219 211V306C219 325 206 334 189 334H131C114 334 101 325 101 306V211C101 191 100 173 106 159C115 138 137 129 137 112V70Z"
            fill={`url(#${id}-glass)`}
            stroke="#cfdfd3"
            strokeOpacity=".7"
            strokeWidth="1.5"
          />
          <rect
            x="134"
            y="53"
            width="52"
            height="29"
            rx="5"
            fill={`url(#${id}-cap)`}
          />
          {[140, 148, 156, 164, 172, 180].map((x) => (
            <path key={x} d={`M${x} 58V75`} stroke="#254d35" opacity=".45" />
          ))}
          <path
            d="M138 88H182M139 96H181"
            stroke="#f1ffed"
            opacity=".5"
            strokeWidth="2"
          />
          {material === "plastic" &&
            [183, 200, 217, 263, 280, 297].map((y) => (
              <g key={y}>
                <path
                  d={`M103 ${y}Q159 ${y + 17} 217 ${y}`}
                  stroke="#ebf6ee"
                  strokeOpacity=".65"
                  strokeWidth="3"
                />
                <path
                  d={`M104 ${y + 5}Q159 ${y + 20} 216 ${y + 5}`}
                  stroke="#425f51"
                  strokeOpacity=".6"
                  strokeWidth="2"
                />
              </g>
            ))}
          <path
            d="M123 166C135 147 146 144 148 123M119 172V300"
            stroke="white"
            strokeOpacity=".6"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <path
            d="M204 178V305"
            stroke="#efffe8"
            strokeOpacity=".35"
            strokeWidth="3"
          />
          {material === "glass" && (
            <>
              <rect x="102" y="205" width="116" height="72" fill="#dce8ce" />
              <path
                d="M145 230H176M135 244H186M146 257H175"
                stroke="#254d35"
                strokeWidth="3"
              />
            </>
          )}
          <path
            d="M110 319Q160 336 210 319"
            stroke="#e7f4e6"
            strokeOpacity=".65"
            strokeWidth="3"
          />
        </g>
      )}
      {material === "paper" && (
        <g transform="rotate(-12 160 190)">
          <path d="M80 90H228V311H80Z" fill="#c1cbb7" />
          <path d="M92 76H240V298H92Z" fill="#f5f7f2" />
          <path d="M115 110H180" stroke="#254d35" strokeWidth="11" />
          {[143, 162, 181, 200, 219, 238, 257].map((y) => (
            <path
              key={y}
              d={`M115 ${y}H218`}
              stroke="#9da894"
              strokeWidth="3"
            />
          ))}
        </g>
      )}
      {material === "cardboard" && (
        <g>
          <path d="M63 154L160 110L259 155L160 202Z" fill="#c7a878" />
          <path d="M63 154V274L160 325V202Z" fill="#b48e60" />
          <path d="M160 202L259 155V273L160 325Z" fill="#96734b" />
          <path
            d="M160 110V202L117 181L216 134"
            stroke="#e5cfa9"
            strokeWidth="22"
          />
          <path d="M160 202V325" stroke="#785b3c" strokeWidth="2" />
          <path
            d="M189 247L227 227M189 256L227 236"
            stroke="#624a31"
            strokeWidth="4"
          />
        </g>
      )}
      {material === "metal" && (
        <g transform="rotate(12 160 190)">
          <rect
            x="96"
            y="98"
            width="128"
            height="213"
            rx="22"
            fill={`url(#${id}-metal)`}
          />
          <ellipse
            cx="160"
            cy="99"
            rx="63"
            ry="17"
            fill="#b8c6bc"
            stroke="#eaf1e6"
            strokeWidth="4"
          />
          <ellipse
            cx="160"
            cy="100"
            rx="47"
            ry="10"
            stroke="#7b8e7d"
            strokeWidth="2"
          />
          <ellipse
            cx="160"
            cy="101"
            rx="17"
            ry="7"
            stroke="#5d6e60"
            strokeWidth="5"
          />
          <rect x="97" y="166" width="126" height="84" fill="#c5f36b" />
          <path
            d="M128 208H190M144 194H177M144 223H177"
            stroke="#254d35"
            strokeWidth="5"
          />
          <path d="M105 304Q160 323 215 304" stroke="#dee7dc" strokeWidth="3" />
        </g>
      )}
      {material === "organic" && (
        <g>
          <path
            d="M158 304C70 283 56 152 144 162C164 165 174 165 191 160C280 140 259 286 182 307Z"
            fill="#79974c"
          />
          <path
            d="M160 170C159 137 177 119 187 113"
            stroke="#637444"
            strokeWidth="9"
            strokeLinecap="round"
          />
          <path
            d="M161 145C112 146 102 118 105 90C147 89 169 111 161 145Z"
            fill="#c5f36b"
          />
          <path
            d="M112 187C91 209 108 255 120 268"
            stroke="#bdd077"
            strokeWidth="7"
            strokeLinecap="round"
          />
        </g>
      )}
    </svg>
  );
}
