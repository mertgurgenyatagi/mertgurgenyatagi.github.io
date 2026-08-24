import * as ort from 'onnxruntime-web'

// Random delay of 1, 2, or 2.5 seconds
export async function botDelay() {
  const delays = [1000, 2000, 2500]
  const ms = delays[Math.floor(Math.random() * delays.length)]
  return new Promise(resolve => setTimeout(resolve, ms))
}

const sessions: Record<string, ort.InferenceSession> = {}

async function getSession(modelName: string): Promise<ort.InferenceSession> {
  if (!sessions[modelName]) {
    // Relative to public directory where index.html is served
    sessions[modelName] = await ort.InferenceSession.create(`/footydraft/models/${modelName}.onnx`)
  }
  return sessions[modelName]
}

export async function evaluateCandidateScorer(
  modelName: string,
  contextTensorData: Float32Array,
  contextLen: number,
  candidateFeaturesData: Float32Array,
  candidateFeatureLen: number,
  numCandidates: number
): Promise<number> {
  const session = await getSession(modelName)
  
  const contextTensor = new ort.Tensor('float32', contextTensorData, [1, contextLen])
  const candidateFeaturesTensor = new ort.Tensor('float32', candidateFeaturesData, [1, numCandidates, candidateFeatureLen])
  
  const maskData = new Uint8Array(numCandidates).fill(1)
  const candidateMaskTensor = new ort.Tensor('bool', maskData, [1, numCandidates])

  const feeds = {
    context: contextTensor,
    candidate_features: candidateFeaturesTensor,
    candidate_mask: candidateMaskTensor
  }

  const results = await session.run(feeds)
  const logits = results.logits.data as Float32Array
  
  // Argmax over logits
  let bestIdx = 0
  let bestVal = -Infinity
  for (let i = 0; i < logits.length; i++) {
    if (logits[i] > bestVal) {
      bestVal = logits[i]
      bestIdx = i
    }
  }
  return bestIdx
}

export async function evaluateDiscreteHead(
  modelName: string,
  featuresData: Float32Array,
  obsLen: number,
  legalActionMask: boolean[]
): Promise<number> {
  const session = await getSession(modelName)
  
  const featuresTensor = new ort.Tensor('float32', featuresData, [1, obsLen])
  
  const maskData = new Uint8Array(legalActionMask.length)
  for (let i = 0; i < legalActionMask.length; i++) {
    maskData[i] = legalActionMask[i] ? 1 : 0
  }
  const actionMaskTensor = new ort.Tensor('bool', maskData, [1, legalActionMask.length])

  const feeds = {
    features: featuresTensor,
    action_mask: actionMaskTensor
  }

  const results = await session.run(feeds)
  const logits = results.logits.data as Float32Array
  
  let bestIdx = -1
  let bestVal = -Infinity
  for (let i = 0; i < logits.length; i++) {
    if (legalActionMask[i] && logits[i] > bestVal) {
      bestVal = logits[i]
      bestIdx = i
    }
  }
  return bestIdx
}
