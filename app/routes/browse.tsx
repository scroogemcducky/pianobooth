import { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { createClient } from "~/utils/supabase.server";
// import process from 'process'

export async function loader({ request, context }: LoaderFunctionArgs) {
  // Access env variables from context.cloudflare.env
  const supabaseUrl = context.cloudflare.env.SUPABASE_URL;
  const supabaseKey = context.cloudflare.env.SUPABASE_KEY;
  
  console.log('SUPABASE_URL:', supabaseUrl);
  console.log('SUPABASE_KEY:', supabaseKey);
  
  const supabase = createClient(request, { 
    SUPABASE_URL: supabaseUrl, 
    SUPABASE_ANON_KEY: supabaseKey 
  });
  
  try {
    const { data: todos } = await supabase.from('Midi').select();
    console.log('Todos data:', todos);
    return { todos };
  } catch (error) {
    console.error('Error fetching todos:', error);
    throw error;
  }
}

export default function Index() {
  const { todos } = useLoaderData<typeof loader>();

  const handleSongClick = (midiData: string) => {
    const midiFile = {
      data: midiData,
      type: 'audio/midi'
    };
    localStorage.setItem('midiFile', JSON.stringify(midiFile));
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-12 text-center font-garamond">Catalogue</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {todos?.map((todo) => (
          <Link 
            key={todo.id}
            to="/play" 
            onClick={() => handleSongClick(todo.Data)}
            className="block"
          >
            <div className="bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300 overflow-hidden">
              <div className="p-6">
                <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    // className="w-8 h-8 text-rose-600 ml-1" 
                    className="w-8 h-8 text-white"
                    viewBox="0 0 24 24" 
                    fill="currentColor"
                  >
                    <path 
                      fillRule="evenodd" 
                      d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" 
                      clipRule="evenodd" 
                    />
                  </svg>
                </div>
                {/* <h2 className="text-xl font-semibold text-center text-gray-800 mb-2 truncate">
                  {todo.Song}
                </h2>
                <p className="text-gray-600 text-center truncate">
                  {todo.Artist}
                </p> */}
                <p className="text-xl mb-2 text-center font-garamond">{todo.Song}</p>
                <p className="text-gray-700 text-center font-garamond">{todo.Artist}</p>
              </div>
              
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}