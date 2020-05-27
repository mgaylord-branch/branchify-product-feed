import { readFile } from './TestUtils'
import { transform } from '../transformers/Transformer'
import { loadFeedConfigurations, FeedConfiguration } from '../models/Mapping'
import { parseProducts, convertProducts } from '../handlers/feed'
import { Product } from '../models/Product'
import { StringStream } from 'scramjet'

describe('Mapping functions', () => {
  var configPath = jest.requireActual('path').join(__dirname, '../mappings/FeedConfig.json')
  console.info(`Loading config path: ${configPath}`)
  var feedConfig: any
  var configurations: FeedConfiguration[]
  var products: Product[]
  var fileContents: string
  beforeEach(async() => {
    const configFile = await readFile(configPath)
    feedConfig = JSON.parse(configFile)
    console.log(`Feed config: ${JSON.stringify(feedConfig)}`)
     configurations = loadFeedConfigurations(feedConfig)

     const testFile = jest.requireActual('path').join(__dirname, '../../test-feeds/GoogleFeed_432_en.tsv')
     fileContents = await readFile(testFile)
     products = parseProducts(fileContents, '\t')
  })
  
  it('Loads feed configuration without errors', () => {
    expect(configurations.length).toEqual(2)
    const { destinationKey, linkConfiguration, linkTemplate } = configurations[0]
    expect(destinationKey).toEqual('facebook-products.csv')
    expect(linkTemplate).toEqual('https://branchster.app.link/?%243p=a_facebook&~ad_id={{ad.id}}&~ad_name={{ad.name}}&~ad_set_id={{adset.id}}&~ad_set_name={{adset.name}}&~campaign={{campaign.name}}&~campaign_id={{campaign.id}}')
    const {excluded, link_key, mappings} = linkConfiguration
    expect(excluded.length).toEqual(0)
    expect(link_key).toEqual('link')
    expect(mappings.length).toEqual(3)
  })

  it('Parses a tabbed csv to JSON correctly', async (done) => {
    const linkKey = configurations[0].linkConfiguration.link_key
    expect(products.length).toEqual(263)
    for (var i = 0; i < products.length; i++) {
      expect(products[i][linkKey]).toBeTruthy()
    }
    done()
  })

  it('Parses using StringStream', async (done) => {
    var header: String
    const result = await StringStream.from(fileContents, { maxParallel: 10 })
    .lines('\n')
    .batch(20)
    .map(async function(chunks: Array<string>) {
      var input = ''
      if (!header) {
        header = chunks[0]
        input = chunks.join('\n')
      } else {
        input = header + '\n' + chunks.join('\n')
      }
      const products = parseProducts(input, "\t")
      return convertProducts(products, configurations[0])
    })
    .toArray()
    console.debug(`Products: ${JSON.stringify(result.length)}`)
    expect(result.length).toEqual(14873)
    done()
  })

  it('Transforms products correctly', () => {
    const configurations = loadFeedConfigurations(feedConfig)
    const result = transform(products, configurations[0])
    expect(result.length).toEqual(products.length)
    expect(result[0]['link']).toContain('.app.link')
  })
})