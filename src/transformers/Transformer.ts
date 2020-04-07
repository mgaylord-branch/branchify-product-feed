import { Product } from '../models/Product'
import { FeedConfiguration } from '../models/Mapping'

export function transform(products: Product[], config: FeedConfiguration) : Product[] {
  const {linkConfiguration, linkConfiguration: { link_key }, linkTemplate } = config
  return products.map(product => {
    let transformed = product
    console.debug(`linkKey: ${link_key} from product: ${JSON.stringify(transformed)}`)
    const productLink = product[link_key]
    if (!productLink) {
      throw Error(`Link key: ${link_key} missing product object`)
    }
    var link = `${linkTemplate}&%24fallback_url=${productLink}`
    Object.keys(product).forEach(key => {
      if (!!linkConfiguration.excluded.find(ex => ex === key)) {
        return
      }
      var value = product[key]
      if (value && typeof value === 'string' && value.indexOf('{{') !== 0) {
        value = encodeURIComponent(value)
      }
      const mapping = linkConfiguration.mappings.find(mapping => mapping.feedKey === key)
      if (!!mapping) {
        link = `${link}&${encodeURIComponent(mapping.branchKey)}=${value}`  
        return
      }
      link = `${link}&${key}=${value}`
    })
    transformed[link_key] = link
    return transformed
  })
}