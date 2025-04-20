import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  entries: [
    'src/index',
    'src/cli',
    'src/cli/list-endpoints'
  ],
  clean: true,
  declaration: true,
  rollup: {
    emitCJS: false,
    inlineDependencies: true,
  },
  failOnWarn: false
})