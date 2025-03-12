import {C_new} from '../../public/c_new'
import {C_sharp_new} from '../../public/c_sharp_new'
import {D_new} from '../../public/d_new'
import {D_sharp_new} from '../../public/d_sharp_new'
import {E_new} from '../../public/e_new'
import {F_new} from '../../public/f_new'
import {F_sharp_new} from '../../public/f_sharp_new'
import {G_new} from '../../public/g_new'
import {G_sharp_new} from '../../public/g_sharp_new'
import {A_new} from '../../public/a_new'
import {A_sharp_new} from '../../public/a_sharp_new'
import {B_new} from '../../public/b_new'

import { useThree } from '@react-three/fiber'
import { white_size_vector, keysOffset } from '../utils/experimentalConstants'

const offset = 7*2.55

export function Octave( { octave }) {

    const { viewport } = useThree();
    const offset2 = 0;
    // const offset2 = viewport.height/2-(white_size_vector.x)

    return (
        <group position={[(octave-3)*offset, keysOffset,0]}>
            <C_new/>
            <C_sharp_new/>
            <D_new/>
            <D_sharp_new/>
            <E_new/>
            <F_new/>
            <F_sharp_new/>
            <G_new/>
            <G_sharp_new/>
            <A_new/>
            <A_sharp_new/>
            <B_new/>ß
         </group>
    )
}


