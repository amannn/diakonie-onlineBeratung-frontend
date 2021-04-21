import {
	generateAskerSession,
	generateMessage,
	generateMessagesReply,
	generateConsultantSession,
	sessionsReply
} from './sessions';
import { CyHttpMessages, RouteHandler } from 'cypress/types/net-stubbing';
import { mockWebSocket } from './websocket';
import { UserDataInterface } from 'amannn-caritas-online-beratung-frontend';

interface MockedLoginArgs {
	type?: 'asker' | 'consultant';
	auth?: {
		expires_in?: number;
		refresh_expires_in?: number;
	};
	// TODO: why is this type not available in userservice's openapi spec?
	userData?: Partial<UserDataInterface>;
	attachmentUpload?: Partial<CyHttpMessages.IncomingResponse>;
	sessions?:
		| UserService.Schemas.UserSessionResponseDTO[]
		| UserService.Schemas.ConsultantSessionResponseDTO[];
	messages?: MessageService.Schemas.MessagesDTO[];
	userSessionsTimeout?: number;
	sessionsCallback?: RouteHandler;
}

declare global {
	namespace Cypress {
		interface Chainable {
			mockedLogin(args?: MockedLoginArgs): Chainable<Element>;
		}
	}
}

Cypress.Commands.add('mockedLogin', (args: MockedLoginArgs = {}) => {
	mockWebSocket();

	cy.fixture('auth.token').then((auth) =>
		cy
			.intercept(
				'POST',
				'/auth/realms/diakonie-online-beratung/protocol/openid-connect/token',
				{
					...auth,
					...args.auth
				}
			)
			.as('authToken')
	);

	cy.intercept(
		'POST',
		'/auth/realms/diakonie-online-beratung/protocol/openid-connect/logout',
		{}
	).as('authLogout');

	let sessions = args.sessions;

	if (args.sessionsCallback) {
		cy.intercept(
			'GET',
			`/service/users/sessions/consultants?status=2*`,
			args.sessionsCallback
		);
	}

	if (!args.type || args.type === 'asker') {
		cy.fixture('service.users.data.askers').then((userData) => {
			cy.intercept('GET', '/service/users/data', {
				...userData,
				...args.userData
			});
		});

		if (!args.sessionsCallback) {
			sessions = args.sessions || [generateAskerSession()];
			cy.intercept('GET', '/service/users/sessions/askers', (req) => {
				return new Promise((resolve) =>
					setTimeout(() => {
						req.reply({
							sessions
						});
						resolve();
					}, args.userSessionsTimeout || 0)
				);
			}).as('askerSessions');
		}
	}

	if (args.type === 'consultant') {
		cy.fixture('service.users.data.consultants').then((userData) => {
			cy.intercept('GET', '/service/users/data', {
				...userData,
				...args.userData
			});
		});

		if (!args.sessionsCallback) {
			sessions = args.sessions || [
				generateConsultantSession(),
				generateConsultantSession(),
				generateConsultantSession()
			];

			cy.intercept(
				'GET',
				`/service/users/sessions/consultants?status=2*`,
				(req) => {
					const url = new URL(req.url);

					const offset =
						parseInt(url.searchParams.get('offset')) || 0;
					const count = parseInt(url.searchParams.get('count')) || 15;

					return new Promise((resolve) =>
						setTimeout(() => {
							req.reply(
								sessionsReply({
									sessions,
									offset,
									count
								})
							);
							resolve();
						}, args.userSessionsTimeout || 0)
					);
				}
			).as('consultantSessionsRequest');
		}
	}

	cy.intercept('GET', `/service/users/sessions/consultants?status=1*`, {});

	const messages = args.messages || [
		generateMessage({ rcGroupId: sessions[0].session.groupId })
	];
	cy.intercept('GET', '/service/messages', (req) => {
		const url = new URL(req.url);

		req.reply(
			generateMessagesReply(
				messages.filter(
					(message) =>
						message.rid === url.searchParams.get('rcGroupId')
				)
			)
		);
	});

	cy.intercept('POST', '/api/v1/subscriptions.read', (req) => {
		sessions.forEach((session) => {
			if (session.session.groupId === req.body.rid) {
				session.session.messagesRead = true;
			}
		});
		req.reply('{}');
	});

	cy.intercept('POST', '/api/v1/login', {
		fixture: 'api.v1.login.json'
	});

	cy.intercept('POST', '/api/v1/logout', {}).as('apiLogout');

	cy.intercept('/service/live', {});

	cy.intercept('GET', '/service/messages/draft', {});

	cy.intercept('POST', '/service/uploads/new/', {
		statusCode: 201,
		...args.attachmentUpload
	}).as('attachmentUpload');

	cy.intercept('POST', '/service/videocalls/new', {
		fixture: 'service.videocalls.new'
	});

	cy.intercept('POST', '/service/videocalls/reject', {});

	cy.visit('login.html');

	cy.get('#loginRoot');
	cy.get('#username').type('username', { force: true });
	cy.get('#passwordInput').type('password', {
		force: true
	});
	cy.get('.button__primary').click();
	cy.wait('@authToken');
	cy.get('#appRoot').should('be.visible');

	// TODO: give initial app code a chance to run, this should not
	// arbitrarly wait but instead the DOM should have some indication
	// somewhere that the app finished doing all initial work
	return cy.wait(500); // eslint-disable-line cypress/no-unnecessary-waiting
});
