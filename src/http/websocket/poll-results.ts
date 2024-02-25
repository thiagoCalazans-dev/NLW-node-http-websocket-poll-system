import { FastifyInstance } from "fastify";
import { voting } from "../../utils/voting-pub-subs";
import z from "zod";

export async function pollResults(app: FastifyInstance) {
  app.get(
    "/polls/:pollId/results",
    { websocket: true },
    (connection, request) => {
      const getPollParams = z.object({
        pollId: z.string().uuid(),
      });

      const { pollId } = getPollParams.parse(request.params);
      //inscrever apenas nas mensagens publicadas (pub) no canal "polId"
      voting.subscribe(pollId, (message) => {
        connection.socket.send(JSON.stringify(message));
      });
    }
  );
}

//pub/sub -> patern muito usado para eventos, categorizando eles.
