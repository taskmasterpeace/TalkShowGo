import { redirect } from 'next/navigation'

// The app front door is the TSG COMMAND control room.
export default function Home() {
  redirect('/command')
}
