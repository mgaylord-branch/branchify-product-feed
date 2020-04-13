export interface FeedConfiguration {
  name: string,
  linkTemplate: string,
  linkConfiguration: LinkConfiguration,
  destinationKey: string
}

export interface LinkConfiguration {
  excluded: string[],
  link_key: string,
  mappings: Mapping[]
}

export interface Mapping {
  feedKey: string,
  branchKey: string
}

export function loadFeedConfigurations(config: any): FeedConfiguration[] {
  const { ad_partners, link_configuration } = config
  return ad_partners.map((partner): FeedConfiguration => {
    const { name, template, destinationKey } = partner
    return {
      linkTemplate: template,
      linkConfiguration: link_configuration,
      destinationKey,
      name
    }
  })
}