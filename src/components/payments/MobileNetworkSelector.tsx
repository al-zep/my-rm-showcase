import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import vodacomAsset from "@/assets/networks/vodacom_logo.svg.asset.json";
import airtelAsset from "@/assets/networks/airtel_logo.svg.asset.json";
import yasAsset from "@/assets/networks/yas_logo.svg.asset.json";
import halotelAsset from "@/assets/networks/halotel_logo.svg.asset.json";

export interface MobileNetwork {
  /** Stable internal id (kept for backend compatibility) */
  id: string;
  /** Display name */
  name: string;
  /** Logo URL */
  logo: string;
}

export const MOBILE_NETWORKS: MobileNetwork[] = [
  { id: "mpesa", name: "Vodacom", logo: vodacomAsset.url },
  { id: "tigopesa", name: "Mixx by Yas", logo: yasAsset.url },
  { id: "airtel", name: "Airtel", logo: airtelAsset.url },
  { id: "halopesa", name: "Halotel", logo: halotelAsset.url },
];

interface Props {
  network: MobileNetwork;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

/**
 * Reusable mobile network selectable card.
 * - Equal dimensions, transparent bg, subtle border, rounded corners
 * - Hover animation, selected state uses primary/gold
 * - Keyboard accessible (native button)
 */
const MobileNetworkSelector = ({ network, selected, disabled, onSelect }: Props) => {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      aria-label={network.name}
      className={cn(
        "group relative flex items-center justify-center w-full h-16 px-3 rounded-xl border-2 bg-white/95 transition-all duration-200",
        "hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-gold/60",
        selected
          ? "border-gold shadow-lg shadow-gold/20 ring-2 ring-gold/40"
          : "border-border/40 hover:border-gold/50",
        disabled && "opacity-60 cursor-not-allowed hover:translate-y-0 hover:shadow-none"
      )}
    >
      <img
        src={network.logo}
        alt={network.name}
        className="max-h-10 min-h-8 w-auto object-contain pointer-events-none select-none"
        draggable={false}
      />
      {selected && (
        <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-gold flex items-center justify-center shadow">
          <CheckCircle2 className="w-3 h-3 text-primary" />
        </span>
      )}
    </button>
  );
};

export default MobileNetworkSelector;
