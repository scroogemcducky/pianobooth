import { MetaFunction } from "@remix-run/node";
import { Link } from "@remix-run/react";
import { slugify } from "~/utils/slugify";

export const meta: MetaFunction = () => {
  return [
    { title: "Browse Classical Piano Music | Piano Learning App" },
    { name: "description", content: "Browse and discover classical piano pieces from Bach, Beethoven, Chopin, Debussy, and more. Interactive piano learning with MIDI playback." }
  ];
};

export default function Index() {
  // Composer images mapping
  const composerImages = {
    'Bach': '/images/Bach2.jpg',
    'Beethoven': '/images/Beethoven4.jpg',
    'Chopin': '/images/Chopin3.jpg',
    'Debussy': '/images/Debussy3.jpg',
    'Pirate': '/images/Sparrow3.jpg'
  };

  const allPieces: Record<string, { title: string; url: string }[]> = {
    Bach: [
      { title: 'Prelude & Fugue No. 1 in C major, BWV 846', url: '/bach/prelude-and-fugue-in-c-major-bwv-846' },
      { title: 'Prelude & Fugue No. 2 in C minor, BWV 847', url: '/bach/prelude-and-fugue-in-c-minor-bwv-847' },
      { title: 'Prelude & Fugue in D major, BWV 850', url: '/bach/pr-ludium-und-fuge-in-d-dur-bwv-850' },
    ],
    Beethoven: [
      { title: 'Piano Sonata No. 23 "Appassionata" I', url: '/beethoven/piano-sonata-no-23-op-57-in-f-minor-i' },
      { title: 'Appassionata', url: '/beethoven/appassionata' },
      { title: 'Für Elise', url: '/beethoven/fur-elise' },
      { title: 'Hammerklavier Sonata – 1st movement', url: '/beethoven/hammerklaviersonate-1-satz' },
      { title: 'Hammerklavier Sonata – 2nd movement', url: '/beethoven/hammerklaviersonate-2-satz' },
      { title: 'Hammerklavier Sonata – 3rd movement', url: '/beethoven/hammerklaviersonate-3-satz' },
      { title: 'Hammerklavier Sonata – 4th movement', url: '/beethoven/hammerklaviersonate-4-satz' },
      { title: 'Les Adieux Sonata – 1st movement', url: '/beethoven/sonate-les-adieux-1-satz' },
      { title: 'Les Adieux Sonata – 2nd movement', url: '/beethoven/sonate-les-adieux-2-satz' },
      { title: 'Les Adieux Sonata – 3rd movement', url: '/beethoven/sonate-les-adieux-3-satz' },
      { title: 'Moonlight Sonata', url: '/beethoven/mondscheinsonate-der-grafin-giulietta-guiccardi-gewidmet' },
      { title: 'Sonata No. 14 in C# minor – 1st movement', url: '/beethoven/sonata-no-14-c-sharp-minor-1-movement' },
      { title: 'Sonata No. 5 in C minor – 1st movement', url: '/beethoven/sonata-no-5-c-minor-1-movement' },
      { title: 'Sonata Op. 10 No. 1 – 2nd movement', url: '/beethoven/sonate-op-10-no-1-2-satz' },
      { title: 'Sonata Op. 10 No. 1 – 3rd movement', url: '/beethoven/sonate-opus-10-no-1-3-satz' },
      { title: 'Sonata Op. 90 – 1st movement', url: '/beethoven/sonate-opus-90-1-satz' },
      { title: 'Sonata Op. 90 – 2nd movement', url: '/beethoven/sonate-opus-90-2-satz' },
      { title: 'Grande Sonata Op. 22 – 1st movement', url: '/beethoven/grande-sonata-opus-22-1-movement' },
      { title: 'Grande Sonata Op. 22 – 2nd movement', url: '/beethoven/grande-sonata-opus-22-2-movement' },
      { title: 'Grande Sonata Op. 22 – 3rd movement', url: '/beethoven/grande-sonata-opus-22-3-movement' },
      { title: 'Grande Sonata Op. 22 – 4th movement', url: '/beethoven/grande-sonate-opus-22-4-movement' },
    ],
    Chopin: [
      { title: 'Grand Valse Brillante, Op. 18', url: '/chopin/grand-valse-brillante-in-es-dur-opus-18' },
      { title: 'Scherzo in B minor, Op. 31', url: '/chopin/scherzo-in-b-moll-opus-31' },
      { title: 'Ballade in G minor, Op. 23', url: '/chopin/chopin-ballade-in-g-minor-opus-32' },
      { title: 'Polonaise in Ab major, Op. 53', url: '/chopin/chopin-polonaise-in-ab-major-opus-53' },
      { title: 'Nocturne Op. 27 No. 1', url: '/chopin/chopin-nocturne-opus-27-nr-1' },
      { title: 'Nocturne Op. 27 No. 2', url: '/chopin/chopin-nocturne-opus-27-nr-2' },
      { title: 'Prelude No. 1, Op. 28', url: '/chopin/chopin-prelude-no-1-opus-28' },
      { title: 'Prelude No. 2, Op. 28', url: '/chopin/chopin-prelude-no-2-opus-28' },
      { title: 'Prelude No. 3, Op. 28', url: '/chopin/chopin-prelude-no-3-opus-28' },
      { title: 'Prelude No. 4, Op. 28', url: '/chopin/chopin-prelude-no-4-opus-28' },
      { title: 'Prelude No. 5, Op. 28', url: '/chopin/chopin-prelude-no-5-opus-28' },
      { title: 'Prelude No. 6, Op. 28', url: '/chopin/chopin-prelude-no-6-opus-28' },
      { title: 'Prelude No. 7', url: '/chopin/chopin-prelude-no-7' },
      { title: 'Prelude No. 9', url: '/chopin/chopin-prelude-no-9' },
      { title: 'Prelude No. 12, Op. 28', url: '/chopin/chopin-prelude-no-12-opus-28' },
      { title: 'Prelude No. 13, Op. 28', url: '/chopin/chopin-prelude-no-13-opus-28' },
      { title: 'Prelude No. 14, Op. 28', url: '/chopin/chopin-prelude-no-14-opus-28' },
      { title: 'Prelude No. 15 "Raindrop"', url: '/chopin/chopin-prelude-no-15-opus-28' },
      { title: 'Prelude No. 16, Op. 28', url: '/chopin/chopin-prelude-no-16-opus-28' },
      { title: 'Prelude No. 17, Op. 28', url: '/chopin/chopin-prelude-no-17-opus-28' },
      { title: 'Prelude No. 18, Op. 28', url: '/chopin/chopin-prelude-no-18-opus-28' },
      { title: 'Prelude No. 19, Op. 28', url: '/chopin/chopin-prelude-no-19-opus-28' },
      { title: 'Prelude No. 20, Op. 28', url: '/chopin/chopin-prelude-no-20-opus-28' },
      { title: 'Prelude No. 21, Op. 28', url: '/chopin/chopin-prelude-no-21-opus-28' },
      { title: 'Prelude No. 22, Op. 28', url: '/chopin/chopin-prelude-no-22-opus-28' },
      { title: 'Prelude No. 23, Op. 28', url: '/chopin/chopin-prelude-no-23-opus-28' },
      { title: 'Prelude No. 24, Op. 28', url: '/chopin/chopin-prelude-no-24-opus-28' },
      { title: 'Étude No. 1, Op. 25', url: '/chopin/chopin-etude-no-1-opus-25' },
      { title: 'Étude No. 2, Op. 25', url: '/chopin/chopin-etude-no-2-opus-25' },
      { title: 'Étude No. 3, Op. 25', url: '/chopin/chopin-etude-no-3-opus-25' },
      { title: 'Étude No. 4, Op. 25', url: '/chopin/chopin-etude-no-4-opus-25' },
      { title: 'Étude No. 12, Op. 25', url: '/chopin/chopin-etude-no-12-opus-25' },
      { title: 'Étude Op. 10 No. 5 "Black Keys"', url: '/chopin/etude-opus-10-no-5' },
      { title: 'Mazurka Op. 7 No. 1', url: '/chopin/chopin-mazurka-opus-7-no-1' },
      { title: 'Mazurka Op. 7 No. 2', url: '/chopin/chopin-mazurka-opus-7-no-2' },
      { title: 'Mazurka Op. 33 No. 2', url: '/chopin/chopin-mazurka-opus-33-nr-2' },
      { title: 'Mazurka Op. 33 No. 4', url: '/chopin/chopin-mazurka-opus-33-nr-4' },
      { title: 'Impromptu in C# minor, Op. 66', url: '/chopin/impromptu-in-c-minor-opus-66' },
      { title: 'Sonata Op. 35 – 1st movement', url: '/chopin/sonate-opus-35-1-satz' },
      { title: 'Sonata Op. 35 – 2nd movement (Funeral March)', url: '/chopin/sonate-opus-35-2-satz' },
      { title: 'Sonata Op. 35 – 4th movement', url: '/chopin/sonate-opus-35-4-satz' },
    ],
    Debussy: [
      { title: 'Clair de Lune', url: '/debussy/clair-de-lune' },
      { title: 'Doctor Gradus ad Parnassum', url: '/debussy/doctor-gradus-ad-parnassum' },
      { title: "Jimbo's Lullaby", url: '/debussy/jimbo-s-lullaby' },
      { title: 'Passepied', url: '/debussy/passepied' },
      { title: 'Serenade of the Doll', url: '/debussy/serenade-of-the-doll' },
      { title: 'The Snow is Dancing', url: '/debussy/the-snow-is-dancing' },
      { title: "Children's Corner No. 5", url: '/debussy/childrens-corner-5' },
      { title: "Children's Corner No. 6", url: '/debussy/childrens-corner-6' },
      { title: 'Menuet', url: '/debussy/menuet' },
      { title: 'Prelude', url: '/debussy/prelude' },
    ],
    Pirate: [
      { title: "He's a Pirate", url: '/klaus-badelt/hes-a-pirate' },
    ],
  };

  // Include all composers in regular layout, with Pirate (Sparrow) last
  const regularComposers = Object.entries(allPieces).sort(([a], [b]) => {
    if (a === 'Pirate') return 1;
    if (b === 'Pirate') return -1;
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
    const composerDisplay = composer === 'Pirate' ? 'Jack Sparrow' : composer;
    return (
      <div key={composer} className="mb-12">
        {/* Composer Header */}
        <div className="flex flex-col md:flex-row mb-6">
          {composerImages[composer] && (
            <img 
              src={composerImages[composer]} 
              alt={composer}
              className="w-56 h-64 object-cover mb-4 md:mb-0 md:mr-6 flex-shrink-0 mx-auto md:mx-0"
            />
          )}
          <div className="ml-4 md:ml-0">
            <h2 className="text-2xl font-bold font-garamond text-gray-800 mb-4 underline">{composerDisplay}</h2>
            
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
              const pieces = allPieces[composer];
              return pieces ? renderComposer(composer, pieces) : null;
            })}
          </div>
          
          {/* Right Column */}
          <div>
            {rightColumn.map(composer => {
              const pieces = allPieces[composer];
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
