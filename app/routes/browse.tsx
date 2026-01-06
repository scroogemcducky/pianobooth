import type { MetaFunction } from "react-router";
import { Link } from "react-router";
import { slugify } from "~/utils/slugify";
import { allPieces, composerImages } from "~/data/artists";

export const meta: MetaFunction = () => {
  return [
    { title: "Browse Classical Piano Music | Piano Learning App" },
    { name: "description", content: "Browse and discover classical piano pieces from Bach, Beethoven, Chopin, Debussy, and more. Interactive piano learning with MIDI playback." }
  ];
};

export default function Index() {
  // Filter out Jack Sparrow and Christmas from browse page
  const browsePieces = Object.fromEntries(
    Object.entries(allPieces).filter(([composer]) => composer !== 'Jack Sparrow' && composer !== 'Christmas')
  );

  // Include all composers in regular layout
  const regularComposers = Object.entries(browsePieces).sort(([a], [b]) => {
    return a.localeCompare(b);
  });

  // Automatically balance columns based on song count
  const leftColumn: string[] = [];
  const rightColumn: string[] = [];
  let leftCount = 0;
  let rightCount = 0;

  regularComposers.forEach(([composer, pieces]) => {
    if (leftCount <= rightCount) {
      leftColumn.push(composer);
      leftCount += pieces.length;
    } else {
      rightColumn.push(composer);
      rightCount += pieces.length;
    }
  });

  const renderComposer = (composer: string, pieces: { title: string; url: string }[]) => {
    const composerSlug = slugify(composer);
    return (
      <div key={composer} id={composerSlug} className="mb-12">
        {/* Composer Header */}
        <div className="flex flex-col md:flex-row mb-6">
          {composerImages[composer] ? (
            <img
              src={composerImages[composer]}
              alt={composer}
              className="w-56 h-64 object-cover mb-4 md:mb-0 md:mr-6 flex-shrink-0 mx-auto md:mx-0"
            />
          ) : (
            <div className="w-56 h-64 bg-white mb-4 md:mb-0 md:mr-6 flex-shrink-0 mx-auto md:mx-0" />
          )}
          <div className="ml-4 md:ml-0">
            <Link to={`/artist/${composerSlug}`}>
              <h2 className="text-2xl font-bold font-garamond text-gray-800 mb-4 underline hover:text-blue-600">{composer}</h2>
            </Link>

            {/* Pieces List */}
            <div>
              {pieces.map((piece, index) => (
                <Link
                  key={`${composer}-${index}`}
                  to={piece.url}
                  className="block mb-2 text-xl font-garamond text-gray-800 hover:text-blue-600 transition-colors"
                >
                  {piece.title}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="container mx-auto px-4 py-8 min-h-screen">
        <div className="mb-16"></div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {/* Left Column */}
          <div>
            {leftColumn.map(composer => {
              const pieces = browsePieces[composer];
              return pieces ? renderComposer(composer, pieces) : null;
            })}
          </div>

          {/* Right Column */}
          <div>
            {rightColumn.map(composer => {
              const pieces = browsePieces[composer];
              return pieces ? renderComposer(composer, pieces) : null;
            })}
          </div>
        </div>
      </div>

      {/* Copyright Section */}
      <div className="mt-16 pt-8 border-t border-black">
        <div className="text-center text-sm font-garamond text-gray-700 leading-relaxed">
          <p className="mb-2">
            The MIDI files of Bernd Krueger are licensed under the cc-by-sa Germany License.
          </p>
          <p className="mb-2">
            This means, that you can use and adapt the files, as long as you attribute to the copyright holder
          </p>
          <p className="mb-2">
            <strong>Name:</strong> Bernd Krueger<br />
            <strong>Source:</strong> <a href="http://www.piano-midi.de" className="text-blue-600 hover:underline">http://www.piano-midi.de</a>
          </p>
          <p className="mb-2">
            The distribution or public playback of the files is only allowed under identical license conditions.
          </p>
          <p>
            The scores are open source.
          </p>
        </div>
      </div>
    </div>
  );
}
