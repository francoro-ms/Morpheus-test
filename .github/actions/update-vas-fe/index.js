#!/usr/bin/env node
const octokit = require('../lib/github')()
const { exec } = require('child_process')
const path = require('path')
const fs = require('fs')
const basePath = path.resolve()
const core = require('@actions/core')
const LIBRARY_TO_UPDATE = '@vas-dev/vas-ui'
const owner = 'vas-dev'
const repo = 'Morpheus-FE'
const libraryRepo = 'vas-fe'

const actor = core.getInput('actor');

const updatePackageJson = async () => {
  console.log(path.resolve())
  await new Promise((resolve, reject) => {
    console.log(`updating ${LIBRARY_TO_UPDATE} library version...`)
    exec(`yarn upgrade ${LIBRARY_TO_UPDATE} --latest`, { cmd: basePath }, (err) => {
      if (err) {
        return reject(err)
      }
      console.log('update in memory sucessful')
      resolve()
    })
  })

  const lockfilePromise = new Promise((resolve, reject) => {
    console.log('reading yarn.lock file')
    fs.readFile(path.join(basePath, 'yarn.lock'), 'utf8', (err, data) => {
      if (err) {
        return reject(err)
      }
      resolve(data)
    })
  })

  const pkgPromise = new Promise((resolve, reject) => {
    console.log('reading package.json file')
    fs.readFile(path.join(basePath, 'package.json'), 'utf8', (err, data) => {
      if (err) {
        return reject(err)
      }
      resolve(data)
    })
  })
  // read package.json and yarn.lock - the physical files should have been updated by the command
  const [packageJson, lockfile] = await Promise.all([pkgPromise, lockfilePromise])
  return {
    'package.json': packageJson,
    'yarn.lock': lockfile,
  }
}

const run = async () => {
  try {
    const changeSetFiles = await updatePackageJson()
    const newVersion = JSON.parse(changeSetFiles['package.json']).dependencies[LIBRARY_TO_UPDATE]
    console.log('retrieving releases...')

    const releases = await octokit.repos.listReleases({ owner, repo: libraryRepo })
    const { body } = releases.data.find(({ tag_name }) => tag_name === newVersion.replace('^', ''))

    console.log('opening PR...')
    const pr = await octokit.createPullRequest({
      owner,
      repo,
      title: `🤖 chore: update ${LIBRARY_TO_UPDATE} to Version ${newVersion}`,
      body: `
This PR updates ${LIBRARY_TO_UPDATE} to version ${newVersion}

## Release Notes ${newVersion}

${body}
      `,
      base: 'master',
      head: `action/update-${LIBRARY_TO_UPDATE}-${Date.now()}`,
      changes: {
        files: changeSetFiles,
        commit: `🤖 chore: update ${LIBRARY_TO_UPDATE} to version ${newVersion}`,
      },
    })
    console.log(`#${pr.data.number} Opened`)

    console.log('adding labels')
    await octokit.issues.addLabels({
      owner,
      repo,
      issue_number: pr.data.number,
      labels: ['dependencies'],
    })

    console.log('adding assignees')
    await octokit.issues.addAssignees({
      owner,
      repo,
      issue_number: pr.data.number,
      assignees: [actor],
    })
    process.exit(0)
  } catch (err) {
    console.log('TCL: run -> err', err)
    console.error('Error while opening PR')
    process.exit(1)
  }
}

run()
