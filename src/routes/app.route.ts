import { expressiumRoute, loggerUtil } from '../../expressium/index.js';
import { createSigmaCloudEventsController, getHealthController } from '../controllers/index.js';

export const buildRoutes = (): void => {
  try {
    expressiumRoute.generateRoute(
      'post',
      '/v1/create/sigma-cloud-events',
      [],
      createSigmaCloudEventsController.createSigmaCloudEvents
    );

    expressiumRoute.generateRoute(
      'get',
      '/v1/get/health',
      [],
      getHealthController.getHealth,
      true
    );
  } catch (error: unknown) {
    loggerUtil.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
};
