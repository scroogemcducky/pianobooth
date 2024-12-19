import { useEffect, useRef } from 'react';;
import { factor, speed, white_size_vector, black_width, white_width, white_color, black_color, positions, note_positions } from '../utils/constants';
import { y, calculateHeight, isBlack, groupByDelta } from '../utils/functions.js';
import  convert3DTo2D  from '~/utils/converter3d';

interface MidiNote {
  NoteNumber: number;
  Duration: number;
  Delta: number;
  SoundDuration: number;
}

interface Block {
  id: number;
  noteNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  duration: number;
  startTime: number;
}

interface Props {
  playing: boolean;
  triggerVisibleNote: (noteNumber: number, duration: number) => void;
  midiObject: MidiNote[];
}

function CanvasMovingBlocks({ playing, triggerVisibleNote, midiObject }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const blocksRef = useRef<Block[]>([]);
  const animationFrameRef = useRef<number>();
  const startTimeRef = useRef<number>(0);
  const lastLogTimeRef = useRef<number>(0);
//   const { convert3DTo2D, convert3DDistanceTo2D } = useCoordinateConverter();

  useEffect(() => {
  

    const canvas = document.getElementById('2d-canvas') as HTMLCanvasElement;
    if (!canvas) return;
    
    canvasRef.current = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight * 0.8;
      // console.log('Canvas resized:', { width: canvas.width, height: canvas.height });
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Initialize blocks
    if (midiObject && midiObject.length > 0) {
    //   const canvasWidth = canvas.width;
    //   const noteRange = 88;
    //   const noteWidth = canvasWidth / noteRange;
      
      blocksRef.current = midiObject.map((note, index) => {
        const isBlackNote = isBlack(note.NoteNumber);
        const width = 100
        // const width = 50 +( isBlack(note.NoteNumber) ? black_width : (white_width - 0.1))
        const height = Math.max(note.Duration / 10000, 20);
        
        // const noteIndex = note.NoteNumber - 21;

        const x = convert3DTo2D(positions[note.NoteNumber], canvas.width, canvas.height)["y"]
        // console.log("x: ", x)

        // const x = (noteIndex * noteWidth) + (noteWidth - width) / 2;
        // const x = 200
        const startTime = note.Delta / 1000;
        
        const block = {
          id: index,
          noteNumber: note.NoteNumber,
          x,
          y: -height,
          width,
          height,
          color: isBlackNote ? '#000000' : '#ffffff',
          duration: note.Duration / 1000000,
          startTime
        };

        // if (index < 5) {
        //   console.log(`Block ${index} created:`, {
        //     noteNumber: block.noteNumber,
        //     delta: note.Delta / 1000,
        //     startTime,
        //     x,
        //     width
        //   });
        // }
        
        return block;
      });

      // console.log(`Total blocks created: ${blocksRef.current.length}`);
    }

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [midiObject]);

  useEffect(() => {
    // console.log('Playing state changed:', playing);
    
    if (!canvasRef.current || !playing) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const fallSpeed = 0.3;
    startTimeRef.current = performance.now();
    lastLogTimeRef.current = startTimeRef.current;

    // console.log('Animation starting at:', startTimeRef.current);

    const animate = (currentTime: number) => {
      const elapsedTime = currentTime - startTimeRef.current;
      
      // Log timing info every second
      // if (currentTime - lastLogTimeRef.current >= 1000) {
      //   console.log('Timing check:', {
      //     currentTime,
      //     elapsedTime,
      //     startTime: startTimeRef.current,
      //     timeSinceLastLog: currentTime - lastLogTimeRef.current
      //   });
      //   lastLogTimeRef.current = currentTime;
      // }

      ctx.fillStyle = '#333333';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      let visibleBlocks = 0;
      let triggeredNotes = 0;

      blocksRef.current.forEach((block) => {
        const blockTime = elapsedTime - block.startTime;
        
        if (blockTime >= 0) {
          const y = blockTime * fallSpeed;
          
          if (y < canvas.height + block.height) {
            visibleBlocks++;
            ctx.fillStyle = block.color;
            ctx.fillRect(block.x, y, block.width, block.height);

            const triggerY = canvas.height - block.height;
            if (y >= triggerY && y <= triggerY + 2) {
              triggeredNotes++;
              // console.log('Triggering note in CanvasMovingBlocks:', {
              //   noteNumber: block.noteNumber,
              //   y,
              //   triggerY,
              //   duration: block.duration * 1000
              // });
              triggerVisibleNote(block.noteNumber, block.duration * 1000);
            }
          }
        }
      });

    //   if (visibleBlocks > 0) {
    //     console.log(`Frame stats: visible=${visibleBlocks}, triggered=${triggeredNotes}`);
    //   }

      if (blocksRef.current.some(block => 
        (elapsedTime - block.startTime) * fallSpeed < canvas.height + block.height
      )) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        // console.log('Animation complete');
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        // console.log('Animation cleanup');
      }
    };
  }, [playing, triggerVisibleNote]);

  return null;
}

export default CanvasMovingBlocks;