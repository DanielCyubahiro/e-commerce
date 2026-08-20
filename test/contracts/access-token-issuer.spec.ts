import { FakeAccessTokenIssuer } from '@test/fakes/fake-access-token.issuer';
import { accessTokenIssuerContract } from './access-token-issuer.contract';

accessTokenIssuerContract('fake issuer', () =>
  Promise.resolve({
    issuer: new FakeAccessTokenIssuer('secret-one'),
    foreign: new FakeAccessTokenIssuer('secret-two'),
  }),
);
