import z from "zod";
import { db } from "../../infra/db";
import { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { redis } from "../../infra/redis";
import { voting } from "../../utils/voting-pub-subs";

export async function voteOnPoll(app: FastifyInstance) {
  app.post("/polls/:pollId/votes", async (request, response) => {
    const voteOnPollBody = z.object({
      pollOptionId: z.string(),
    });

    const voteOnPollParams = z.object({
      pollId: z.string().uuid(),
    });
    const { pollOptionId } = voteOnPollBody.parse(request.body);
    const { pollId } = voteOnPollParams.parse(request.params);

    let { sessionId } = request.cookies;

    if (sessionId) {
      const userPreviousVoteOnPoll = await db.vote.findUnique({
        where: {
          sessionId_pollId: {
            sessionId,
            pollId,
          },
        },
      });

      if (
        userPreviousVoteOnPoll &&
        userPreviousVoteOnPoll.pollOptionId !== pollOptionId
      ) {
        //apagar o velho e criar o mesmo
        await db.vote.delete({
          where: {
            sessionId_pollId: {
              sessionId,
              pollId,
            },
          },
        });

        const votes = await redis.zincrby(
          pollId,
          -1,
          userPreviousVoteOnPoll.pollOptionId
        );
        voting.publish(pollId, {
          pollOptionId,
          votes: Number(votes),
        });
      } else if (userPreviousVoteOnPoll) {
        return response
          .status(400)
          .send({ message: "you already vote on this poll." });
      }
    }

    if (!sessionId) {
      sessionId = randomUUID();

      response.setCookie("sessionId", sessionId, {
        path: "/",
        maxAge: 60 * 60 * 24 * 30, //30 dias
        signed: true,
        httpOnly: true, //garante que a informacao so seja acessada pelo backend
      });
    }

    await db.vote.create({
      data: {
        sessionId,
        pollOptionId,
        pollId,
      },
    });

    const votes = await redis.zincrby(pollId, 1, pollOptionId);

    voting.publish(pollId, {
      pollOptionId,
      votes: Number(votes),
    });

    return response.status(201).send();
  });
}

//33min aula 2
