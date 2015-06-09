const path = require('path')

const targetPathFor = function(localResource, languageCode) {
  if (!localResource.targetFilePath) {
    throw new Error(`Please set targetFilePath for ${localResource}`)
  }

  return localResource
    .targetFilePath
    .replace('_lang_', languageCode)
    .replace('_type_', localResource.type.toLowerCase())
}

const fileNameOf = function(filePath) {
  return path.basename(filePath)
}

const remoteResourceFor = function(localResource, remoteResources) {
  const fileName = fileNameOf(localResource.sourceFile)
  const remoteResourceForLocal = remoteResources.find(resource => resource.name === fileName)
  if (remoteResourceForLocal) {
    return remoteResourceForLocal
  } else {
    throw new Error(`Cannot find remote resource for ${localResource.sourceFile}`)
  }
}

module.exports = class GruntTx {
  constructor({transifex, project, localResources, grunt}) {
    this.transifex = transifex
    this.project = project
    this.localResources = localResources
    this.grunt = grunt
  }

  async downloadResources() {
    const remoteResources = await this.transifex.getResources()

    for (let localResource of this.localResources) {
      const remoteResourceForLocal = remoteResourceFor(localResource, remoteResources)
      const remoteResource = await this.transifex.getResource(remoteResourceForLocal.slug)

      for (let language of remoteResource.available_languages) {
        const translations = await this.transifex.getTranslations(remoteResource.slug, language.code)
        const filePath = targetPathFor(localResource, language.code)

        this.grunt.file.write(filePath, translations)
        this.grunt.log.ok(`[${this.project}] Downloaded ${language.code} to ${filePath}`)
      }
    }
  }

  async uploadResources() {
    const remoteResources = await this.transifex.getResources()

    for (let localResource of this.localResources) {
      const remoteResourceForLocal = remoteResourceFor(localResource, remoteResources)
      const content = this.grunt.file.read(localResource.sourceFile)
      const result = await this.transifex.uploadResource(remoteResourceForLocal.slug, localResource.type, content)

      this.grunt.log.ok(
        `[${this.project}] Uploaded ${localResource.sourceFile}. Added ${result.strings_added}. Updated ${result.strings_updated}. Deleted ${result.strings_delete}.`
      )
    }
  }
}