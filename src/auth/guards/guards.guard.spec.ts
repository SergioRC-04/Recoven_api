import { GuardsGuard } from './jwt-auth.guard';

describe('GuardsGuard', () => {
  it('should be defined', () => {
    expect(new GuardsGuard()).toBeDefined();
  });
});
