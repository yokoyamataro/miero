"use client";

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m) return m[1];
  }
  return null;
}

interface YouTubeEmbedProps {
  url: string;
}

export function YouTubeEmbed({ url }: YouTubeEmbedProps) {
  const id = extractYouTubeId(url);

  if (!id) {
    return (
      <div className="my-3 border border-yellow-500/30 bg-yellow-500/5 rounded p-3 text-sm">
        <div className="text-yellow-600 font-medium mb-1">
          YouTube URLが正しくありません
        </div>
        <code className="text-xs text-muted-foreground break-all">{url}</code>
      </div>
    );
  }

  return (
    <div className="my-3 relative w-full" style={{ paddingBottom: "56.25%" }}>
      <iframe
        src={`https://www.youtube.com/embed/${id}`}
        title="YouTube video"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="absolute inset-0 w-full h-full rounded border"
      />
    </div>
  );
}
