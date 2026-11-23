// Wait between uploads or construction passes without blocking the event loop.
export async function finishGpu(gl) {
  if (gl.isContextLost()) throw new Error('WebGL context lost')
  const fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0)
  if (!fence) return
  gl.flush()
  try {
    let status = gl.clientWaitSync(fence, 0, 0)
    while (status === gl.TIMEOUT_EXPIRED) {
      await new Promise((resolve) => setTimeout(resolve, 8))
      status = gl.clientWaitSync(fence, 0, 0)
    }
    if (status === gl.WAIT_FAILED || gl.isContextLost()) throw new Error('WebGL work did not complete')
  } finally {
    gl.deleteSync(fence)
  }
}
