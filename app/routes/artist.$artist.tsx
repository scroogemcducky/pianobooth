import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData } from "react-router";
import { allPieces, composerImages, findArtistBySlug } from "~/data/artists";

export const loader = ({ params }: LoaderFunctionArgs) => {
  const artistSlug = params.artist;
  if (!artistSlug) {
    throw new Response("Artist not found", { status: 404 });
  }

  const artist = findArtistBySlug(artistSlug);
  if (!artist) {
    throw new Response("Artist not found", { status: 404 });
  }

  return {
    artistName: artist.name,
    pieces: artist.pieces,
    artistSlug
  };
};

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data) {
    return [{ title: "Artist Not Found" }];
  }
  return [
    { title: `${data.artistName} - Piano Pieces | Piano Learning App` },
    { name: "description", content: `Browse and play piano pieces by ${data.artistName}. Interactive piano learning with MIDI playback.` }
  ];
};

export default function ArtistPage() {
  const { artistName, pieces, artistSlug } = useLoaderData<typeof loader>();
  const image = composerImages[artistName];

  return (
    <div className="container mx-auto px-4 py-8 min-h-screen">
      <div className="mb-8 font-garamond text-gray-600">
        <Link to="/" className="hover:text-gray-800">Home</Link>
        <span className="mx-2">/</span>
        <Link to="/browse" className="hover:text-gray-800">Browse</Link>
      </div>

      <div className="flex flex-col md:flex-row gap-8 mb-12">
        {/* Artist Image */}
        <div className="flex-shrink-0">
          {image ? (
            <img
              src={image}
              alt={artistName}
              className="w-72 h-80 object-cover mx-auto md:mx-0"
            />
          ) : (
            <div className="w-72 h-80 bg-gray-100 mx-auto md:mx-0" />
          )}
        </div>

        {/* Artist Info */}
        <div>
          <h1 className="text-4xl font-bold font-garamond text-gray-800 mb-8">{artistName}</h1>

          {/* Songs List */}
          <div>
            {pieces.map((piece, index) => (
              <Link
                key={`${artistSlug}-${index}`}
                to={piece.url}
                className="block mb-3 text-xl font-garamond text-gray-800 hover:text-blue-600 transition-colors"
              >
                {piece.title}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
