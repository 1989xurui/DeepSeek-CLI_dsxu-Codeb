const path = process.env.DSXU_DEEPSEEK_TRAJECTORY_FILE
if (!path) throw new Error('DSXU_DEEPSEEK_TRAJECTORY_FILE is required')

const records = [
  {
    event: 'request_plan',
    requestTag: 'sample-capture-1',
    redacted: true,
    modelName: 'deepseek-v4-flash',
    routeReason: 'sample_capture',
  },
  {
    event: 'request_messages',
    requestTag: 'sample-capture-1',
    redacted: true,
    assistantToolCalls: [
      {
        id: 'tool-capture-1',
        name: 'Read',
        argumentChars: 24,
        argumentHash: 'capture-arg-hash',
        argumentKeys: ['file_path'],
      },
    ],
    toolResults: [
      {
        toolCallId: 'tool-capture-1',
        contentChars: 96,
        contentHash: 'capture-result-hash',
      },
    ],
    toolResultCount: 1,
    rawContentStored: false,
  },
  {
    event: 'response_usage',
    requestTag: 'sample-capture-1',
    redacted: true,
    responseModel: 'deepseek-v4-flash',
    routeReason: 'sample_capture',
    usage: {
      input_tokens: 900,
      output_tokens: 77,
      cache_read_input_tokens: 600,
      cache_creation_input_tokens: 300,
    },
  },
]

await Bun.write(path, `${records.map(record => JSON.stringify(record)).join('\n')}\n`)
console.log('sample trajectory written')

