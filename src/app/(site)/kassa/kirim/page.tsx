import type { Metadata } from "next";
import { DirectionPage } from "../direction";
import type { Search } from "../search";

export const metadata: Metadata = { title: "Приход — касса — photopoly" };

export default function IncomePage({ searchParams }: { searchParams: Promise<Search> }) {
  return <DirectionPage kind="INCOME" searchParams={searchParams} />;
}
