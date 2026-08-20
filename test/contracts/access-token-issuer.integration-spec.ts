import { JoseAccessTokenIssuer } from '@/identity/infrastructure';
import { accessTokenIssuerContract } from './access-token-issuer.contract';

// Constructed with plain values rather than through Nest's DI: the adapter's
// constructor reads two settings and holds no other collaborator, so a
// container would add setup without adding coverage.
accessTokenIssuerContract('jose adapter', () =>
  Promise.resolve({
    issuer: new JoseAccessTokenIssuer('a'.repeat(32), 900),
    foreign: new JoseAccessTokenIssuer('b'.repeat(32), 900),
  }),
);
