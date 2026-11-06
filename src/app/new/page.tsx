import type { Metadata } from "next";
import { NewEventForm } from "@/components/NewEventForm";

export const metadata: Metadata = { title: "New event" };

export default function NewEventPage() {
  return <NewEventForm />;
}
