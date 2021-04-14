import {
	generateMultipleAskerSessions,
	generateMultipleConsultantSessions,
	sessionsReply
} from '../support/sessions';

const MAX_ITEMS_TO_SHOW_WELCOME_ILLUSTRATION = 3;
const SCROLL_PAGINATE_THRESHOLD = 50; // pixel

describe('Sessions', () => {
	describe('Consultant', () => {
		it('should list my sessions', () => {
			const amountOfSessions = 3;
			const sessions = generateMultipleConsultantSessions(
				amountOfSessions
			);
			cy.caritasMockedLogin({
				type: 'consultant',
				sessions
			});

			cy.get('a[href="/sessions/consultant/sessionView"]').click();
			cy.get('.sessionsListItem').should('have.length', amountOfSessions);
		});

		it('should fetch next batch of sessions if scroll threshold is reached', () => {
			const amountOfSessions = 100;
			const sessions = generateMultipleConsultantSessions(
				amountOfSessions
			);

			cy.caritasMockedLogin({
				type: 'consultant',
				sessions
			});

			cy.get('a[href="/sessions/consultant/sessionView"]').click();
			cy.get('.sessionsListItem').should('exist');
			cy.wait('@consultantSessionsRequest');

			cy.get('.sessionsList__scrollContainer').then(
				([scrollContainer]) => {
					const scrollPosition =
						Math.ceil(scrollContainer.scrollTop) +
						scrollContainer.offsetHeight;

					const scrollable =
						scrollContainer.scrollHeight - scrollPosition;

					cy.get('.sessionsList__scrollContainer').scrollTo(
						0,
						scrollable - SCROLL_PAGINATE_THRESHOLD
					);
				}
			);

			cy.wait('@consultantSessionsRequest');
		});

		it('should not fetch next batch of sessions if scroll threshold is not reached', () => {
			const amountOfSessions = 100;
			const sessions = generateMultipleConsultantSessions(
				amountOfSessions
			);

			cy.caritasMockedLogin({
				type: 'consultant',
				sessions
			});

			cy.get('a[href="/sessions/consultant/sessionView"]').click();
			cy.wait('@consultantSessionsRequest');
			cy.get('.sessionsListItem').should('exist');

			cy.get('.sessionsList__scrollContainer').then(
				([scrollContainer]) => {
					const scrollPosition =
						Math.ceil(scrollContainer.scrollTop) +
						scrollContainer.offsetHeight;

					const scrollable =
						scrollContainer.scrollHeight - scrollPosition;

					cy.get('.sessionsList__scrollContainer').scrollTo(
						0,
						scrollable - SCROLL_PAGINATE_THRESHOLD - 1
					);
				}
			);

			cy.get('.skeleton__item').should('not.exist');
		});

		describe('Access Token expires while logged in', () => {
			it('should logout if trying to paginate sessions', () => {
				const amountOfSessions = 100;
				const sessions = generateMultipleConsultantSessions(
					amountOfSessions
				);

				cy.caritasMockedLogin({
					type: 'consultant',
					sessions,
					sessionsCallback: (req) => {
						const url = new URL(req.url);
						if (parseInt(url.searchParams.get('offset')) > 0) {
							req.reply(401);
						} else {
							req.reply(sessionsReply({ sessions }));
						}
					}
				});

				cy.get('a[href="/sessions/consultant/sessionView"]').click();
				cy.get('.sessionsListItem').should('exist');

				cy.get('.sessionsList__scrollContainer').scrollTo('bottom');
				cy.get('#loginRoot').should('exist');
			});
		});
	});

	describe('Asker', () => {
		it('should list my sessions', () => {
			const amountOfSessions = 3;
			const sessions = generateMultipleAskerSessions(amountOfSessions);
			cy.caritasMockedLogin({
				type: 'asker',
				sessions
			});

			cy.get('.sessionsListItem').should('have.length', amountOfSessions);
		});

		it('should show a header with headline', () => {
			cy.caritasMockedLogin({
				type: 'asker'
			});
			cy.get('[data-cy=session-list-header]').should('exist');
			cy.get('[data-cy=session-list-headline]').contains(
				'Meine Nachrichten'
			);
		});

		describe('welcome illustration', () => {
			it('should show until given session item limit is reached', () => {
				const amountOfSessions = MAX_ITEMS_TO_SHOW_WELCOME_ILLUSTRATION;
				const sessions = generateMultipleAskerSessions(
					amountOfSessions
				);
				cy.caritasMockedLogin({
					type: 'asker',
					sessions
				});
				cy.get('[data-cy=session-list-welcome-illustration]').should(
					'exist'
				);
			});

			it('should not show when given session item limit is reached', () => {
				const amountOfSessions =
					MAX_ITEMS_TO_SHOW_WELCOME_ILLUSTRATION + 1;
				const sessions = generateMultipleAskerSessions(
					amountOfSessions
				);
				cy.caritasMockedLogin({
					type: 'asker',
					sessions
				});
				cy.get('[data-cy=session-list-welcome-illustration]').should(
					'not.exist'
				);
			});
		});
	});
});
