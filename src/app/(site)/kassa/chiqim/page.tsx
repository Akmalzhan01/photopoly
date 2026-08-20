import type { Metadata } from "next";
import { DirectionPage } from "../direction";
import type { Search } from "../search";

export const metadata: Metadata = { title: "Расход — касса — photopoly" };

export default function ExpensePage({ searchParams }: { searchParams: Promise<Search> }) {
  return <DirectionPage kind="EXPENSE" searchParams={searchParams} />;
}
