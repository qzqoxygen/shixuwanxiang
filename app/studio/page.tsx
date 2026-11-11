import type { Metadata } from "next";
import InkLandscape from "@/components/InkLandscape";
import StudioWorkbench from "./StudioWorkbench";
import "./studio.css";

export const metadata: Metadata = { title: "造物" };

export default function StudioPage() {
  return <>
    <InkLandscape />
    <StudioWorkbench />
  </>;
}
