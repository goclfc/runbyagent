import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function LogRedirect() {
  redirect('/changelog');
}
