"use server";

import { after } from "next/server";
import {
  saveOnboardingAnswersBody,
  saveOnboardingFeaturesSchema,
} from "@/utils/actions/onboarding.validation";
import { actionClientUser } from "@/utils/actions/safe-action";
import prisma from "@/utils/prisma";
import { updateContactCompanySize, updateContactRole } from "@inboxzero/loops";

export const completedOnboardingAction = actionClientUser
  .metadata({ name: "completedOnboarding" })
  .action(async ({ ctx: { userId } }) => {
    await prisma.user.updateMany({
      where: { id: userId, completedOnboardingAt: null },
      data: { completedOnboardingAt: new Date() },
    });
  });

export const saveOnboardingAnswersAction = actionClientUser
  .metadata({ name: "saveOnboardingAnswers" })
  .inputSchema(saveOnboardingAnswersBody)
  .action(
    async ({
      parsedInput: { surveyId, questions, answers },
      ctx: { userId, userEmail, logger },
    }) => {
      function extractSurveyAnswers(questions: unknown, answers: unknown) {
        const result: {
          surveyFeatures?: string[];
          surveyRole?: string;
          surveyGoal?: string;
          surveyCompanySize?: number;
          surveySource?: string;
          surveyImprovements?: string;
        } = {};

        const questionList = Array.isArray(questions) ? questions : [];
        const answerRecord =
          answers && typeof answers === "object"
            ? (answers as Record<string, unknown>)
            : null;

        if (!questionList.length || !answerRecord) return result;

        // Helper to get answer by question key
        const getAnswerByKey = (key: string) => {
          const questionIndex = questionList.findIndex((question) => {
            if (!question || typeof question !== "object") return false;
            const record = question as Record<string, unknown>;
            return record.key === key;
          });
          if (questionIndex === -1) return null;

          const answerKey =
            questionIndex === 0
              ? "$survey_response"
              : `$survey_response_${questionIndex}`;
          const answer = answerRecord[answerKey];

          return answer && answer !== "" ? answer : null;
        };

        // Extract features (multiple choice)
        const featuresAnswer = getAnswerByKey("features");
        if (featuresAnswer) {
          if (typeof featuresAnswer === "string") {
            const features = featuresAnswer
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
              .filter((s) => s !== "undefined");
            if (features.length > 0) {
              result.surveyFeatures = features;
            }
          } else if (Array.isArray(featuresAnswer)) {
            const features = featuresAnswer.filter(
              (feature): feature is string =>
                typeof feature === "string" &&
                feature !== "undefined" &&
                feature.trim().length > 0,
            );
            if (features.length > 0) {
              result.surveyFeatures = features;
            }
          }
        }

        // Extract other single choice/text answers - only set if not undefined/null/empty
        const roleAnswer = getAnswerByKey("role");
        if (typeof roleAnswer === "string" && roleAnswer !== "undefined") {
          result.surveyRole = roleAnswer;
        }

        const goalAnswer = getAnswerByKey("goal");
        if (typeof goalAnswer === "string" && goalAnswer !== "undefined") {
          result.surveyGoal = goalAnswer;
        }

        const companySizeAnswer = getAnswerByKey("company_size");
        if (
          companySizeAnswer !== null &&
          companySizeAnswer !== "undefined" &&
          companySizeAnswer !== undefined
        ) {
          const numericValue =
            typeof companySizeAnswer === "number"
              ? companySizeAnswer
              : Number(companySizeAnswer);
          if (!Number.isNaN(numericValue)) {
            result.surveyCompanySize = numericValue;
          }
        }

        const sourceAnswer = getAnswerByKey("source");
        if (typeof sourceAnswer === "string" && sourceAnswer !== "undefined") {
          result.surveySource = sourceAnswer;
        }

        const improvementsAnswer = getAnswerByKey("improvements");
        if (
          typeof improvementsAnswer === "string" &&
          improvementsAnswer !== "undefined"
        ) {
          result.surveyImprovements = improvementsAnswer;
        }

        return result;
      }

      const extractedAnswers = extractSurveyAnswers(questions, answers);

      after(async () => {
        if (extractedAnswers.surveyRole) {
          await updateContactRole({
            email: userEmail,
            role: extractedAnswers.surveyRole,
          }).catch((error) => {
            logger.error("Loops: Error updating role", { error });
          });
        }

        if (extractedAnswers.surveyCompanySize) {
          await updateContactCompanySize({
            email: userEmail,
            companySize: extractedAnswers.surveyCompanySize,
          }).catch((error) => {
            logger.error("Loops: Error updating company size", { error });
          });
        }
      });

      await prisma.user.update({
        where: { id: userId },
        data: {
          onboardingAnswers: { surveyId, questions, answers },
          surveyFeatures: extractedAnswers.surveyFeatures,
          surveyRole: extractedAnswers.surveyRole,
          surveyGoal: extractedAnswers.surveyGoal,
          surveyCompanySize: extractedAnswers.surveyCompanySize,
          surveySource: extractedAnswers.surveySource,
          surveyImprovements: extractedAnswers.surveyImprovements,
        },
      });
    },
  );

export const saveOnboardingFeaturesAction = actionClientUser
  .metadata({ name: "saveOnboardingFeatures" })
  .inputSchema(saveOnboardingFeaturesSchema)
  .action(async ({ ctx: { userId }, parsedInput: { features } }) => {
    await prisma.user.update({
      where: { id: userId },
      data: {
        surveyFeatures: features,
      },
    });
  });
