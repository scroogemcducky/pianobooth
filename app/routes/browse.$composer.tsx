import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { createClient } from "~/utils/supabase.server";
import { slugify } from "~/utils/slugify";
import useMidiStore from "../store/midiStore";

export async function loader({ request, context, params }: LoaderFunctionArgs) {
  const supabaseUrl = context.cloudflare.env.SUPABASE_URL;
  const supabaseKey = context.cloudflare.env.SUPABASE_KEY;

  const supabase = createClient(request, {
    SUPABASE_URL: supabaseUrl,
    SUPABASE_ANON_KEY: supabaseKey,
  });

  const { data: todos = [] } = await supabase.from("Midi").select();

  const composerSlug = params.composer;
  if (!composerSlug) {
    throw new Response("Composer not specified", { status: 400 });
  }

  const composerName = todos.find((todo) => slugify(todo.Artist) === composerSlug)?.Artist;
  if (!composerName) {
    throw new Response("Composer not found", { status: 404 });
  }

  const pieces = todos.filter((todo) => todo.Artist === composerName);

  return { composerName, composerSlug, pieces };
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data) {
    return [{ title: "Composer not found" }];
  }
  return [
    { title: `${data.composerName} Piano Catalogue | Piano Learning App` },
    {
      name: "description",
      content: `Browse the complete MIDI catalogue for ${data.composerName}.`,
    },
  ];
};

export default function ComposerCatalogue() {
  const { composerName, pieces } = useLoaderData<typeof loader>();
  const setMidiStore = useMidiStore((state) => state.setMidiFile);

  const handleSongClick = (midiData: string) => {
    try {
      localStorage.removeItem("processedMidiData");
      const base64Data = midiData.split(",")[1];
      if (!base64Data) {
        throw new Error("Invalid data URL format");
      }
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: "audio/midi" });
      const file = new File([blob], "catalog-song.mid", { type: "audio/midi" });
      setMidiStore(file);
    } catch (error) {
      console.error("Error processing catalog MIDI data:", error);
      alert("Error loading the selected song. Please try again.");
    }
  };

  return (
    <main className="min-h-screen bg-white text-gray-900">
      <section className="container mx-auto px-6 md:px-8 lg:px-10 py-10">
        <div className="mb-8">
          <Link to="/browse" className="text-sm text-blue-600 underline">
            ← Back to Browse
          </Link>
          <h1 className="mt-4 text-3xl font-garamond font-semibold text-stone-900">
            {composerName} Catalogue
          </h1>
          <p className="text-stone-600 mt-2">
            Explore every piece we currently host from {composerName}.
          </p>
        </div>

        <div className="space-y-3">
          {pieces.map((piece) => (
            <button
              key={piece.id}
              onClick={() => handleSongClick(piece.Data)}
              className="w-full text-left rounded-lg border border-stone-200 bg-white px-5 py-4 text-lg font-garamond text-gray-800 hover:border-stone-400 hover:bg-stone-50"
            >
              {piece.Album ? `${piece.Album} - ${piece.Song}` : piece.Song}
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
