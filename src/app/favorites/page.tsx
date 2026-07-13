import { ComingSoon } from "@/components/ComingSoon";
import { MainBottomNav } from "@/components/MainBottomNav";

export default function FavoritesPage() {
  return (
    <>
      <ComingSoon title="מועדפים" message="כאן ירוכזו כל המקומות והחוויות שתסמנו כמועדפים." />
      <MainBottomNav active="favorites" />
    </>
  );
}
