#!/usr/bin/env node

const setupOctokit = require('../lib/github')
const octokit = setupOctokit()

const queryString = require('query-string')
const fetch = require('isomorphic-fetch')
const MD5 = require('md5.js')
const prettier = require('prettier')

const { PRIVATE_KEY, PUBLIC_KEY, SOURCE_FILE_NAME = 'translations.en.json', PROJECT_ID = '149489' } = process.env

const HEADERS = {
  Platform: 'web',
  Authorization: `Bearer ${PRIVATE_KEY}`,
}

const LANGUAGES = ['cs', 'de', 'es', 'et', 'fr-ca', 'it', 'pl', 'ru', 'zh']

const fetchTranslation = async (locale) => {
  const timestamp = Math.floor(Date.now() / 1000)

  const params = queryString.stringify({
    locale,
    api_key: PUBLIC_KEY,
    timestamp,
    source_file_name: SOURCE_FILE_NAME,
    dev_hash: new MD5().update(`${timestamp}${PRIVATE_KEY}`).digest('hex'),
  })

  const results = await fetch(`https://platform.api.onesky.io/1/projects/${PROJECT_ID}/translations?${params}`, {
    headers: HEADERS,
  }).then((response) => {
    try {
      return response.json()
    } catch (error) {
      console.error('Error while downloading translation')
      process.exit(1)
    }
  })

  return results
}

const generateChangeSetFiles = async () => {
  const changeSetFiles = {}
  let promises = []

  LANGUAGES.forEach((locale) => {
    promises.push(
      fetchTranslation(locale).then((translation) => {
        return (changeSetFiles[`src/resources/locales/translations.${locale}.json`] = prettier.format(
          JSON.stringify(translation),
          { parser: 'json' }
        ))
      })
    )
  })

  await Promise.all(promises)

  return changeSetFiles
}

const run = async () => {
  const changeSetFiles = await generateChangeSetFiles()
  octokit
    .createPullRequest({
      owner: 'vas-dev',
      repo: 'Morpheus-FE',
      title: 'chore: update translations',
      body: 'Updating translations from OneSkyApp',
      base: 'master',
      head: `action/update-translations-${Date.now()}`,
      changes: {
        files: changeSetFiles,
        commit: 'chore: update translations',
      },
    })
    .then((pr) => {
      console.log(`#${pr.data.number} Opened`)
      return octokit.issues
        .addLabels({
          owner: 'vas-dev',
          repo: 'Morpheus-FE',
          issue_number: pr.data.number,
          labels: ['Core', 'Translations'],
        })
        .then(() => {
          return octokit.issues.addAssignees({
            owner: 'vas-dev',
            repo: 'Morpheus-FE',
            issue_number: pr.data.number,
            assignees: ['marceloalves'],
          })
        })
    })
    .then(() => process.exit(0))
    .catch((err) => {
      console.log('TCL: run -> err', err)
      console.error('Error while opening PR')
      process.exit(1)
    })
}

run()
