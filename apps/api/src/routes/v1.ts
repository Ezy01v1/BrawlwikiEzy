import { type Request, Router } from 'express';
import { parseBrawlerId, parseLimit, parseRegion, parseTagParam } from '../http/params';
import { sendData } from '../http/respond';
import type { RequestContext, Services } from '../services';

export function createV1Router(
  services: Services,
  contextFor: (req: Request) => RequestContext = () => ({}),
): Router {
  const r = Router();

  r.get('/players/:tag', async (req, res) => {
    sendData(res, await services.player(parseTagParam(req.params.tag), contextFor(req)));
  });
  r.get('/players/:tag/battlelog', async (req, res) => {
    sendData(res, await services.battleLog(parseTagParam(req.params.tag), contextFor(req)));
  });
  r.get('/clubs/:tag', async (req, res) => {
    sendData(res, await services.club(parseTagParam(req.params.tag), contextFor(req)));
  });
  r.get('/rankings/players', async (req, res) => {
    sendData(
      res,
      await services.playerRankings(parseRegion(req.query.region), parseLimit(req.query.limit), contextFor(req)),
    );
  });
  r.get('/rankings/clubs', async (req, res) => {
    sendData(
      res,
      await services.clubRankings(parseRegion(req.query.region), parseLimit(req.query.limit), contextFor(req)),
    );
  });
  r.get('/rankings/brawlers/:brawlerId', async (req, res) => {
    sendData(
      res,
      await services.brawlerRankings(
        parseBrawlerId(req.params.brawlerId),
        parseRegion(req.query.region),
        parseLimit(req.query.limit),
        contextFor(req),
      ),
    );
  });
  r.get('/brawlers', async (req, res) => {
    sendData(res, await services.brawlers(contextFor(req)));
  });
  r.get('/brawlers/:id', async (req, res) => {
    sendData(res, await services.brawler(parseBrawlerId(req.params.id), contextFor(req)));
  });
  r.get('/events/rotation', async (req, res) => {
    sendData(res, await services.eventRotation(contextFor(req)));
  });

  return r;
}
