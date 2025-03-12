const Lights  = () => {
    return (
      <>
      <ambientLight color={"white"} intensity={3} />
      <directionalLight
                intensity={0.4}
                position={[30, -10, 210]}
                color={"white"}
              />
      </>
    )
  }

  export default Lights