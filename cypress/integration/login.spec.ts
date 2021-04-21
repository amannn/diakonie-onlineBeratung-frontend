describe('Login', () => {
	it.only('should be able to login', () => {
		cy.mockedLogin();

		cy.get('#appRoot').should('exist');
	});

	it('displays the login at the root', () => {
		cy.visit('/');
		cy.contains('Login');
	});

	it('displays the login for resorts', () => {
		cy.visit('/suchtberatung');
		cy.contains('Login');
	});
});
