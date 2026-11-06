import { EventScreen } from "@/components/EventScreen";

export default async function EventPage({ params }: PageProps<"/e/[slug]">) {
  const { slug } = await params;
  return <EventScreen slug={slug} />;
}
