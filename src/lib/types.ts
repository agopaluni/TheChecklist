export type EventInfo = {
  id: string;
  slug: string;
  name: string;
  date: string | null;
  end_date: string | null; // set only for multi-day events
  location: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
};

export type Participant = {
  id: string;
  display_name: string;
  is_claimed: boolean;
  created_at: string;
};

export type Item = {
  id: string;
  name: string;
  quantity: string | null;
  note: string | null;
  day: string | null; // a day of a multi-day event, or null for the whole event
  assigned_to: string | null;
  is_checked: boolean;
  created_by: string | null;
  created_at: string;
};

export type EventData = {
  event: EventInfo;
  participants: Participant[];
  items: Item[];
  me: string | null; // participant id this device / account has claimed
};

export type MyEvent = {
  slug: string;
  name: string;
  date: string | null;
  end_date: string | null;
  location: string | null;
  me: string;
  is_creator: boolean;
  total: number;
  ready: number;
};

export type NewItem = { name: string; quantity?: string | null; note?: string | null };
