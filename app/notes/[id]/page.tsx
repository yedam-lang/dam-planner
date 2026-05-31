import NoteDetail from '../../components/NoteDetail'

export default async function NoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <NoteDetail id={id} />
}
