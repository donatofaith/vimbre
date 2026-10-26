import {createGateway} from './gateway.ts'
import {gatewayDependencies} from './runtime.ts'
Deno.serve(createGateway(gatewayDependencies()))
