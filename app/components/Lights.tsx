const Lights  = () => {
    return (
      <>
      <ambientLight color={"white"} intensity={2} />
      <directionalLight
                intensity={1}
                position={[-30, 105, -10]}
                color={"white"}
              />
      <directionalLight
                intensity={4}
                position={[-10,110, -20]}
                color={"#ffffff"}
                // castShadow={false}
              />
      {/* <hemisphereLight intensity={10} color="#ffffff" /> */}
      {/* <hemisphereLight intensity={10} color="#ffffff" /> */}
      </>
    )
  }

  export default Lights