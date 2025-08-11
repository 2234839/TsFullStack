import { Logger } from './logger';

export interface InteractiveDecision {
  type: 'confirmation' | 'clarification' | 'choice';
  question: string;
  options?: string[];
  context?: any;
  required: boolean;
}

export interface InteractiveResponse {
  answer: string;
  confirmed: boolean;
}

export class InteractiveService {
  private logger: Logger;
  private enabled: boolean;
  private confirmBeforeExecution: boolean;
  private askForClarification: boolean;
  private maxQuestions: number;
  private questionsAsked: number;

  constructor(
    config: {
      enabled: boolean;
      confirmBeforeExecution: boolean;
      askForClarification: boolean;
      maxQuestions: number;
    },
    logger: Logger
  ) {
    this.logger = logger;
    this.enabled = config.enabled;
    this.confirmBeforeExecution = config.confirmBeforeExecution;
    this.askForClarification = config.askForClarification;
    this.maxQuestions = config.maxQuestions;
    this.questionsAsked = 0;
  }

  async askQuestion(decision: InteractiveDecision): Promise<InteractiveResponse> {
    if (!this.enabled || this.questionsAsked >= this.maxQuestions) {
      return { answer: decision.required ? 'no' : 'auto', confirmed: false };
    }

    this.questionsAsked++;
    
    this.logger.info('Asking user question', { 
      type: decision.type,
      question: decision.question,
      options: decision.options 
    }, 'InteractiveService');

    try {
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const askQuestion = (question: string): Promise<string> => {
        return new Promise((resolve) => {
          rl.question(question, (answer: string) => {
            resolve(answer.trim().toLowerCase());
          });
        });
      };

      let answer: string;
      
      if (decision.type === 'confirmation') {
        answer = await askQuestion(`${decision.question} (yes/no): `);
        while (answer !== 'yes' && answer !== 'no' && answer !== 'y' && answer !== 'n') {
          answer = await askQuestion('请输入 yes 或 no: ');
        }
        answer = answer.startsWith('y') ? 'yes' : 'no';
        
      } else if (decision.type === 'choice' && decision.options) {
        console.log(decision.question);
        decision.options.forEach((option, index) => {
          console.log(`${index + 1}. ${option}`);
        });
        
        const choice = await askQuestion('请选择 (输入数字): ');
        const choiceIndex = parseInt(choice) - 1;
        
        if (choiceIndex >= 0 && choiceIndex < decision.options.length) {
          answer = decision.options[choiceIndex];
        } else {
          answer = decision.options[0]; // 默认选择第一个
        }
        
      } else {
        answer = await askQuestion(`${decision.question}: `);
      }

      rl.close();
      
      const confirmed = answer !== 'no' && answer !== 'cancel';
      
      this.logger.info('User responded', { 
        answer,
        confirmed,
        type: decision.type 
      }, 'InteractiveService');

      return { answer, confirmed };

    } catch (error) {
      this.logger.error('Failed to ask question', { 
        error: error instanceof Error ? error.message : String(error),
        question: decision.question 
      }, 'InteractiveService');
      
      return { answer: decision.required ? 'no' : 'auto', confirmed: false };
    }
  }

  async confirmExecution(toolName: string, input: any, description?: string): Promise<boolean> {
    if (!this.confirmBeforeExecution || !this.enabled) {
      return true;
    }

    const decision: InteractiveDecision = {
      type: 'confirmation',
      question: `是否要执行工具 "${toolName}"?${description ? `\n描述: ${description}` : ''}\n输入: ${JSON.stringify(input, null, 2)}`,
      required: true
    };

    const response = await this.askQuestion(decision);
    return response.confirmed;
  }

  async requestClarification(taskDescription: string, ambiguity: string): Promise<string> {
    if (!this.askForClarification || !this.enabled) {
      return taskDescription; // 返回原始任务描述
    }

    const decision: InteractiveDecision = {
      type: 'clarification',
      question: `任务描述存在歧义: "${ambiguity}"\n请澄清任务 "${taskDescription}"`,
      required: false
    };

    const response = await this.askQuestion(decision);
    return response.answer || taskDescription;
  }

  async makeChoice(question: string, options: string[], required = false): Promise<string> {
    if (!this.enabled) {
      return options[0]; // 返回默认选项
    }

    const decision: InteractiveDecision = {
      type: 'choice',
      question,
      options,
      required
    };

    const response = await this.askQuestion(decision);
    return response.answer;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getQuestionsAsked(): number {
    return this.questionsAsked;
  }

  reset(): void {
    this.questionsAsked = 0;
  }
}