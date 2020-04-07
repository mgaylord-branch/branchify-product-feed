import { readFile } from './TestUtils'
import { products } from './TestData'
import { transform } from '../transformers/Transformer'
import { loadFeedConfigurations } from '../models/Mapping'

describe('Mapping functions', () => {
  var configPath = jest.requireActual('path').join(__dirname, '../mappings/FeedConfig.json')
  console.info(`Loading config path: ${configPath}`)
  var feedConfig: any
  beforeEach(async() => {
    const configFile = await readFile(configPath)
    feedConfig = JSON.parse(configFile)
    console.log(`Feed config: ${JSON.stringify(feedConfig)}`)
  })
  
  it('Loads feed configuration without errors', () => {
    const configurations = loadFeedConfigurations(feedConfig)
    expect(configurations.length).toEqual(2)
  })

  it('Transforms products correctly', () => {
    const configurations = loadFeedConfigurations(feedConfig)
    const result = transform(products, configurations[0])
    console.log(`Products: ${JSON.stringify(result)}`)
    expect(result.length).toEqual(products.length)
    expect(result[0]['link']).toContain('.app.link')
  })
})